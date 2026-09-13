/** @jest-environment node */

// T-0086 acceptance oracle, half one — the config assembler must stop
// shredding YAML.
//
// THE DEFECT (round-6 QA, finding 9 — CRITICAL; mechanism corrected by
// investigation). ~/.hermes/config.yaml accumulates duplicate mapping keys and
// trailing blocks whose children lost their parent indent, going back months of
// .bak evidence. The reporter blamed `syncDefaultsToHermesConfig` + yaml.dump.
// That function is a clean object round-trip that CANNOT emit duplicate keys —
// it is the only writer that already refuses corrupt input. The true corrupter
// is the text-level assembler in profile-config-builder.ts:
//
//   1. `parseConfigYaml` skips only the HEADER line of each preserved section
//      (model, auxiliary, …), so the indented children leak into
//      `extraYamlLines` — while `extractPreservedSections` also captures the
//      whole section structurally. `buildConfigYaml` emits BOTH: the structured
//      re-dump AND the leaked raw lines appended at the tail. Duplicate keys;
//      orphaned indents.
//   2. The `platform_toolsets` scanner's exit test (`!trimmed.endsWith(":")`)
//      never fires on a following top-level `key:` header, so whole sections
//      that FOLLOW platform_toolsets are swallowed as phantom "platforms"
//      (`memory: []`…) — order-dependent, which is why corruption looked
//      intermittent: Hermes-native section order triggers mechanism 1, the
//      seed's order hides it behind mechanism 2.
//   3. `inAgent` flips off on the same header line that turned it on, so
//      `agent.personality` is NEVER parsed from a top-level agent block —
//      every parse reports "technical", and the real personality line leaks
//      into the extras as one more duplicate source.
//
// These fixtures are the three mechanism-killers plus the properties that make
// a rebuild trustworthy at all: load-clean output, idempotency, unknown-key
// survival, and semantic-compare stability across the format change (so no
// install wakes up "everything drifted").

import { readFileSync } from "fs";
import { join } from "path";
import * as yaml from "js-yaml";

import {
  parseConfigYaml,
  buildConfigYaml,
  configYamlSemanticallyMatches,
  resolvePlatformToolsets,
} from "@/modules/hermes/lib/profile-config-builder";

const SEED_ROOT = readFileSync(
  join(process.cwd(), "data", "seed", "agent-root", "config.yaml"),
  "utf-8",
);
const SEED_SWE = readFileSync(
  join(process.cwd(), "data", "seed", "profiles", "swe", "config.yaml"),
  "utf-8",
);

/**
 * The order a real Hermes writes its own file: managed sections FIRST, the
 * PatterStage-managed skills/platform_toolsets after. This is the order that
 * triggers mechanism 1 on today's builder.
 */
const HERMES_NATIVE = `model:
  default: MiniMax-M3
  provider: minimax
  base_url: https://api.minimax.io/anthropic
  api_key: ""
  extra_body: {}
auxiliary:
  vision:
    provider: bedrock
    model: claude-vision
    base_url: ""
    api_key: ""
    extra_body: {}
agent:
  personality: creative
  max_turns: 40
memory:
  provider: hindsight
  host: 127.0.0.1
  port: 9177
plugins:
  enabled: []
skills:
  disabled:
    - noisy-skill
platform_toolsets:
  cli:
    - web
    - terminal
`;

/** Sections AFTER platform_toolsets — mechanism 2's swallow zone. */
const AFTER_TOOLSETS = `skills:
  disabled: []
platform_toolsets:
  cli:
    - web
memory:
  provider: hindsight
fallback_providers:
  - provider: openai
    model: gpt-4o
  - provider: anthropic
    model: claude
secrets:
  bitwarden:
    enabled: false
version: 2
`;

const rebuild = (content: string) => buildConfigYaml(parseConfigYaml(content));

describe("mechanism 1 — a rebuild emits each section exactly once", () => {
  it("round-trips the Hermes-native section order to load-clean YAML", () => {
    // js-yaml v4 throws on duplicated mapping keys, so a clean load IS the
    // no-duplicates assertion. Today's builder emits model/auxiliary twice —
    // once structurally, once as leaked raw children at the tail.
    const rebuilt = rebuild(HERMES_NATIVE);

    expect(() => yaml.load(rebuilt)).not.toThrow();
  });

  it("keeps the managed and preserved content semantically intact", () => {
    const rebuilt = rebuild(HERMES_NATIVE);
    const doc = yaml.load(rebuilt) as Record<string, unknown>;

    expect(doc.model).toEqual({
      default: "MiniMax-M3",
      provider: "minimax",
      base_url: "https://api.minimax.io/anthropic",
      api_key: "",
      extra_body: {},
    });
    expect((doc.auxiliary as Record<string, unknown>).vision).toMatchObject({
      provider: "bedrock",
      model: "claude-vision",
    });
    expect(doc.memory).toEqual({ provider: "hindsight", host: "127.0.0.1", port: 9177 });
    expect((doc.skills as Record<string, unknown>).disabled).toEqual(["noisy-skill"]);
    expect((doc.platform_toolsets as Record<string, unknown>).cli).toEqual(["web", "terminal"]);
  });

  it("leaves no orphaned indented tail after the last top-level key", () => {
    // The 490:10-style symptom: raw child lines appended after the extras,
    // indented under nothing. A load-clean doc whose top-level key set matches
    // the input's has no room for an orphan block.
    const rebuilt = rebuild(HERMES_NATIVE);
    const doc = yaml.load(rebuilt) as Record<string, unknown>;

    expect(Object.keys(doc).sort()).toEqual(
      ["agent", "auxiliary", "memory", "model", "plugins", "platform_toolsets", "skills"].sort(),
    );
  });
});

describe("mechanism 2 — sections after platform_toolsets are not platforms", () => {
  it("parses the seed root's real platforms and nothing else", () => {
    const parts = parseConfigYaml(SEED_ROOT);
    const platforms = Object.keys(parts.platformToolsets).sort();

    expect(platforms).toEqual(
      ["cli", "discord", "homeassistant", "qqbot", "signal", "slack", "telegram", "whatsapp"].sort(),
    );
    // The three sections that FOLLOW platform_toolsets in the seed file are the
    // exact phantoms today's scanner invents.
    expect(parts.platformToolsets).not.toHaveProperty("memory");
    expect(parts.platformToolsets).not.toHaveProperty("plugins");
    expect(parts.platformToolsets).not.toHaveProperty("agent");
  });

  it("keeps fallback_providers a list of maps, never toolset names", () => {
    // Today the scanner harvests `- provider: openai` as a TOOL called
    // "provider: openai" under a phantom platform.
    const parts = parseConfigYaml(AFTER_TOOLSETS);

    expect(parts.platformToolsets).toEqual({ cli: ["web"] });

    const doc = yaml.load(rebuild(AFTER_TOOLSETS)) as Record<string, unknown>;
    expect(doc.fallback_providers).toEqual([
      { provider: "openai", model: "gpt-4o" },
      { provider: "anthropic", model: "claude" },
    ]);
  });

  it("preserves an unknown section (secrets) and an unknown scalar (version)", () => {
    const doc = yaml.load(rebuild(AFTER_TOOLSETS)) as Record<string, unknown>;

    expect(doc.secrets).toEqual({ bitwarden: { enabled: false } });
    expect(doc.version).toBe(2);
  });
});

describe("mechanism 3 — agent.personality is actually parsed", () => {
  it("reads the personality from a top-level agent block", () => {
    // Today `inAgent` turns off on the header line itself, so this returns
    // "technical" for every config that ever set a personality — and then the
    // real line leaks into the extras as a duplicate source.
    expect(parseConfigYaml(HERMES_NATIVE).personality).toBe("creative");
  });

  it("emits the personality exactly once, inside the agent block", () => {
    const rebuilt = rebuild(HERMES_NATIVE);

    expect(rebuilt.match(/personality:/g)).toHaveLength(1);
    const doc = yaml.load(rebuilt) as { agent?: { personality?: string; max_turns?: number } };
    expect(doc.agent?.personality).toBe("creative");
    // The sibling key the old text splice would have orphaned.
    expect(doc.agent?.max_turns).toBe(40);
  });

  it("the database's personality beats the one already in the file", () => {
    // Found by mutation: every fixture's DB personality equalled the file's,
    // so a build that ignored parts.personality and re-emitted the raw agent
    // block passed. Changing personality in the UI is the whole feature.
    const parts = parseConfigYaml(HERMES_NATIVE);
    expect(parts.personality).toBe("creative");

    const doc = yaml.load(buildConfigYaml({ ...parts, personality: "playful" })) as {
      agent: { personality: string };
    };

    expect(doc.agent.personality).toBe("playful");
  });

  it("does NOT invent an agent section on a config that has none", () => {
    // Byte-shape rule: personality merges into agent only when an agent
    // section exists. Inventing one would wake drift on every
    // personality-less install.
    const rebuilt = rebuild(AFTER_TOOLSETS);

    expect((yaml.load(rebuilt) as Record<string, unknown>).agent).toBeUndefined();
  });

  it("GREEN CONTROL: defaults to technical when nothing says otherwise", () => {
    expect(parseConfigYaml(AFTER_TOOLSETS).personality).toBe("technical");
  });
});

describe("the properties that make a rebuild trustworthy", () => {
  const FIXTURES: Record<string, string> = {
    hermesNative: HERMES_NATIVE,
    afterToolsets: AFTER_TOOLSETS,
    seedRoot: SEED_ROOT,
    seedSwe: SEED_SWE,
  };

  for (const [name, content] of Object.entries(FIXTURES)) {
    it(`idempotency: ${name} rebuilds byte-stable and load-clean`, () => {
      const once = rebuild(content);
      const twice = rebuild(once);

      expect(() => yaml.load(once)).not.toThrow();
      expect(twice).toBe(once);
    });

    it(`fidelity: ${name} keeps every top-level key it started with`, () => {
      const before = (yaml.load(content) ?? {}) as Record<string, unknown>;
      const after = (yaml.load(rebuild(content)) ?? {}) as Record<string, unknown>;

      // The managed sections may be normalised; nothing may VANISH. This is
      // the assertion that kills the compounding data-loss path, where
      // extractPreservedSections' catch → {} silently dropped model/auxiliary.
      for (const key of Object.keys(before)) {
        expect({ fixture: name, key, present: key in after }).toEqual({
          fixture: name,
          key,
          present: true,
        });
      }
    });
  }

  it("the database's edits beat the file's raw managed blocks", () => {
    // Found by mutation: a build that let the preserved copy of `skills`
    // overwrite the managed one passed every round-trip test, because a
    // round trip never CHANGES anything. Push exists to change things.
    const parts = parseConfigYaml(SEED_ROOT);
    const edited = {
      ...parts,
      disabledSkills: ["ops/only-this"],
      platformToolsets: { cli: ["terminal"] },
    };

    const doc = yaml.load(buildConfigYaml(edited)) as Record<string, Record<string, unknown>>;

    expect(doc.skills.disabled).toEqual(["ops/only-this"]);
    expect(doc.platform_toolsets).toEqual({ cli: ["terminal"] });
  });

  it("GREEN CONTROL: an empty config parses to defaults and builds cleanly", () => {
    const parts = parseConfigYaml("");

    expect(parts.personality).toBe("technical");
    expect(parts.disabledSkills).toEqual([]);
    expect(() => yaml.load(buildConfigYaml(parts))).not.toThrow();
  });
});

describe("the format change wakes no false drift", () => {
  it("old-builder output still semantically matches the new assembly", () => {
    // A literal capture of what TODAY's builder emits for a simple config —
    // skills first, toolsets second, nothing else. After the rewrite, the
    // semantic compare re-parses both sides through the SAME parser, so this
    // must still match; a mismatch here is the drift storm the design forbids.
    const oldFormatDisk = "skills:\n  disabled: []\nplatform_toolsets:\n  cli:\n    - web\n";
    const newAssembled = rebuild(oldFormatDisk);

    expect(configYamlSemanticallyMatches(oldFormatDisk, newAssembled)).toBe(true);
  });

  it("an unparseable side is drift, honestly", () => {
    const corrupt = "model:\n  default: a\nmodel:\n  default: b\n";

    expect(configYamlSemanticallyMatches(corrupt, "skills:\n  disabled: []\n")).toBe(false);
  });
});

describe("resolvePlatformToolsets survives the parser change", () => {
  it("still falls back to the yaml when the DB JSON is empty", () => {
    const { toolsets, source } = resolvePlatformToolsets("{}", AFTER_TOOLSETS);

    expect(source).toBe("config_yaml");
    expect(toolsets).toEqual({ cli: ["web"] });
  });

  it("falls through to the seed on unparseable yaml instead of crashing", () => {
    const seed = { cli: ["web"] };
    const { toolsets, source } = resolvePlatformToolsets(
      "{}",
      "model:\n  a: 1\nmodel:\n  b: 2\n",
      seed,
    );

    expect(source).toBe("seed_pack");
    expect(toolsets).toEqual(seed);
  });
});
