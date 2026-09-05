/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports -- better-sqlite3's package root is not newable under the jest transform */

// ═══════════════════════════════════════════════════════════════
// B6 oracle, group config-route-builder, half one (T-0100, D76).
//
// Written before the product code moved. It holds contract section 3's D76
// lines (1) to (10) and the last D78 line (after PUT {show_cost: null} the
// writer's refresh carries the deletion, so no drift wakes).
//
// THE DEFECT. PUT /api/config writes <root>/config.yaml and never touches
// agent_root.config_yaml. pushRootToHermes rebuilds the whole file from that
// stale row, and finalizeRootConfigOnDisk then copies the reverted disk text
// back into the row. In between, detectRootDrift cannot warn, because the
// semantic compare excludes every preserved section. A Settings save is gone
// from disk and database the moment anything pushes Bob.
//
// THE CONTRACT. The row refresh lives in the ONE config.yaml writer
// (writeHermesConfigFile), guarded on "the path written IS the default root's
// config.yaml", so every writer inherits it the way cache invalidation does.
// The semantic compare counts preserved sections (personality stripped from
// agent, keys canonically ordered). The non-managed children of `skills`
// survive a rebuild.
//
// HARNESS. The shape of the-push-either-works-or-says-what-happened: a real
// in-memory database, a real temp Hermes home, the real writer, the real
// push and the real drift detector. agent-root-repository is a recording
// wrapper over the real module, so "updateAgentRoot was not called" is
// asserted directly AND the row is real. HERMES_HOME is the default root for
// every case but the profile-home one, because finalize resolves through
// getActiveHermesPaths while the push resolves through getHermesDefaultRoot
// (critique-config gap 7), and the oracle must sit on the side of that seam
// where both coincide.
//
// GREEN CONTROLs here pin what the contract keeps once the compare gets
// stricter: no false drift after the PUT, no refresh at a profile home, no
// refresh on the 409 path, key order and the injected personality are not
// drift.
// ═══════════════════════════════════════════════════════════════

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import * as yaml from "js-yaml";

const hermesHome = mkdtempSync(join(tmpdir(), "ps-b6-save-survives-"));
/** The home the ROUTE writes to. The push and the drift detector always use hermesHome. */
let activeHome = hermesHome;

// Both path resolvers are mocked, for the reason the-push harness spells out:
// profile-push and profile-drift read getHermesDefaultRoot from profile-paths,
// and a missed mock there writes fixtures over the operator's real Hermes home.
jest.mock("@/modules/hermes/lib/profile-paths", () => {
  const { buildHermesPathBundle } = jest.requireActual(
    "@/modules/hermes/lib/paths",
  ) as typeof import("@/modules/hermes/lib/paths");
  const resolveHome = (slug: string) =>
    slug === "default" ? hermesHome : join(hermesHome, "profiles", slug);
  return {
    getHermesDefaultRoot: () => hermesHome,
    resolveProfileHermesHome: resolveHome,
    buildProfileHermesPathBundle: (slug: string) => buildHermesPathBundle(resolveHome(slug)),
    isProfileHermesHome: (home: string) => /[\\/]profiles[\\/][^\\/]+$/.test(home),
  };
});

jest.mock("@/modules/hermes/lib/agent-runtime", () => {
  const { buildHermesPathBundle } = jest.requireActual(
    "@/modules/hermes/lib/paths",
  ) as typeof import("@/modules/hermes/lib/paths");
  return {
    getHermesDefaultRoot: () => hermesHome,
    getActiveHermesPaths: () => buildHermesPathBundle(activeHome),
    getActiveHermesHome: () => activeHome,
    getAgentLlmEndpoints: () => ({
      apiUrl: "http://127.0.0.1:9/v1/chat/completions",
      gatewayBase: "http://127.0.0.1:9",
    }),
  };
});

// A recording wrapper, not a stub: the row must be REAL for the push to
// assemble from it, and the call must be OBSERVABLE for the two "never
// refreshes" lines.
const mockUpdateAgentRoot = jest.fn();
jest.mock("@/lib/agent-root-repository", () => {
  const actual = jest.requireActual(
    "@/lib/agent-root-repository",
  ) as typeof import("@/lib/agent-root-repository");
  return {
    ...actual,
    updateAgentRoot: (patch: Parameters<typeof actual.updateAgentRoot>[0]) => {
      mockUpdateAgentRoot(patch);
      return actual.updateAgentRoot(patch);
    },
  };
});

let testDb: import("better-sqlite3").Database | null = null;
jest.mock("@/lib/db", () => ({
  now: () => new Date().toISOString(),
  getDb: () => testDb!,
  ensureDb: () => undefined,
  inTransaction: <T,>(fn: () => T) => testDb!.transaction(fn)(),
  uuid: () => "b6-uuid",
}));

// The audit ledger and the analytics ledger both write under PS_DATA_DIR or
// the database; neither is what this file measures.
jest.mock("@/lib/audit-log", () => ({ appendAuditLine: jest.fn() }));
jest.mock("@/lib/analytics/record-event", () => ({ recordEvent: jest.fn() }));

import { NextRequest } from "next/server";

import { execBaselineSchema } from "../helpers/baseline-db";
import { PUT } from "@/app/api/config/route";
import { getAgentRoot, updateAgentRoot } from "@/lib/agent-root-repository";
import { pushRootToHermes } from "@/modules/hermes/lib/profile-push";
import { detectRootDrift } from "@/modules/hermes/lib/profile-drift";
import { writeHermesConfigFile } from "@/modules/hermes/lib/hermes-config-write";
import {
  buildConfigYaml,
  configYamlSemanticallyMatches,
  parseConfigYaml,
} from "@/modules/hermes/lib/profile-config-builder";

// ── fixtures ────────────────────────────────────────────────────

/**
 * A root whose managed parts are pinned on BOTH sides. The row carries the
 * same platform_toolsets as the file so the seed-pack fallback in
 * resolvePlatformToolsets never enters the compare; the only thing that can
 * differ between disk and row in these tests is a preserved section.
 */
const ROOT_BEFORE = [
  "skills:",
  "  disabled: []",
  "platform_toolsets:",
  "  cli:",
  "    - web",
  "display:",
  "  skin: mono",
  "",
].join("\n");
const ROOT_TOOLSETS_JSON = JSON.stringify({ cli: ["web"] });

/** The same root, with the one key a Settings save adds. */
const ROOT_WITH_SHOW_COST = ROOT_BEFORE + "  show_cost: true\n";

const MALFORMED = "agent:\n  max_turns: 100\n  max_turns: 200\n";

const rootConfigPath = () => join(hermesHome, "config.yaml");

function freshHome(): void {
  rmSync(hermesHome, { recursive: true, force: true });
  mkdirSync(hermesHome, { recursive: true });
}

/** Disk and row hold `text`; the recorder forgets the seeding write. */
function seedRoot(diskText: string, rowText: string = diskText): void {
  writeFileSync(rootConfigPath(), diskText, "utf-8");
  updateAgentRoot({ configYaml: rowText, platformToolsetsJson: ROOT_TOOLSETS_JSON });
  mockUpdateAgentRoot.mockClear();
}

function putConfig(section: string, values: Record<string, unknown>) {
  return PUT(
    new NextRequest("http://localhost/api/config", {
      method: "PUT",
      body: JSON.stringify({ section, values }),
    }),
  );
}

const diskConfig = (): string => readFileSync(rootConfigPath(), "utf-8");
const diskDoc = (): Record<string, Record<string, unknown>> =>
  yaml.load(diskConfig()) as Record<string, Record<string, unknown>>;

const savedHermesHome = process.env.HERMES_HOME;
const savedAgentHome = process.env.AGENT_HOME;

beforeEach(() => {
  const Database = require("better-sqlite3/lib/index.js") as typeof import("better-sqlite3");
  testDb = new (Database as unknown as new (path: string) => import("better-sqlite3").Database)(
    ":memory:",
  );
  execBaselineSchema(testDb);
  jest.clearAllMocks();
  freshHome();
  activeHome = hermesHome;
  process.env.HERMES_HOME = hermesHome;
  delete process.env.AGENT_HOME;
});

afterEach(() => {
  testDb?.close();
  testDb = null;
});

afterAll(() => {
  if (savedHermesHome === undefined) delete process.env.HERMES_HOME;
  else process.env.HERMES_HOME = savedHermesHome;
  if (savedAgentHome === undefined) delete process.env.AGENT_HOME;
  else process.env.AGENT_HOME = savedAgentHome;
  rmSync(hermesHome, { recursive: true, force: true });
});

// ── FUSE ────────────────────────────────────────────────────────

describe("FUSE: this file writes only where it is allowed to", () => {
  it("resolves the Hermes default root inside the OS temp directory", () => {
    // The T-0082 incident rule. This reads the value the push will use, so a
    // mock that stops intercepting fails here and not on somebody's disk.
    const { getHermesDefaultRoot } = require("@/modules/hermes/lib/profile-paths") as {
      getHermesDefaultRoot: () => string;
    };
    expect(getHermesDefaultRoot().startsWith(tmpdir())).toBe(true);
  });

  it("the route and the push agree on the root config.yaml", () => {
    const { getActiveHermesPaths } = require("@/modules/hermes/lib/agent-runtime") as {
      getActiveHermesPaths: () => { config: string };
    };
    // Compared with separators normalised: the bundle joins with "/", the
    // fixture with the platform separator, and that is the second thing to
    // get wrong.
    const norm = (p: string) => p.replace(/\\/g, "/");
    expect(getActiveHermesPaths().config).toContain("ps-b6-save-survives-");
    expect(norm(getActiveHermesPaths().config)).toBe(norm(rootConfigPath()));
  });
});

// ── D76: the writer refreshes the row ───────────────────────────

describe("writeHermesConfigFile refreshes agent_root.config_yaml when it writes the default root", () => {
  it("hands the row the exact bytes it wrote", () => {
    // The ONE writer, called directly. PUT, the fallback writer, the
    // syncDefaults callers and pushModel all inherit this line; testing it at
    // the writer is what makes "every writer" a single assertion.
    seedRoot(ROOT_BEFORE);

    writeHermesConfigFile(rootConfigPath(), ROOT_WITH_SHOW_COST);

    expect(mockUpdateAgentRoot).toHaveBeenCalledWith(
      expect.objectContaining({ configYaml: ROOT_WITH_SHOW_COST }),
    );
    expect(getAgentRoot().configYaml).toBe(ROOT_WITH_SHOW_COST);
  });
});

// ── D76 contract (1), (3), (4), (5): the PUT ────────────────────

describe("PUT /api/config against the default root", () => {
  it("(1) writes show_cost to disk AND refreshes the row with the same bytes", async () => {
    seedRoot(ROOT_BEFORE);

    const res = await putConfig("display", { show_cost: true });

    expect(res.status).toBe(200);
    expect(diskDoc().display.show_cost).toBe(true);
    // Byte equality, not "contains": the row is what the next push assembles
    // from, and a row that merely mentions show_cost is not the file.
    expect(getAgentRoot().configYaml).toBe(diskConfig());
    expect(getAgentRoot().configYaml).toContain("show_cost: true");
  });

  it("GREEN CONTROL (3): row and disk agree after the PUT, so no config.yaml drift wakes", async () => {
    // Green today because the compare ignores preserved sections. Once (6)
    // and (9) make it count them, this line is what keeps a Save from
    // lighting the banner: the refresh in (1) and the compare in (6) land
    // together or not at all.
    seedRoot(ROOT_BEFORE);

    await putConfig("display", { show_cost: true });

    expect(detectRootDrift().fields).not.toContain("config.yaml");
  });

  it("GREEN CONTROL (4): at a profile home the PUT writes that profile's file and leaves the root row alone", async () => {
    // HERMES_HOME=.../profiles/x makes the route edit the profile's
    // config.yaml. That file is not what agent_root.config_yaml mirrors, so
    // refreshing the row from it would be a different corruption.
    seedRoot(ROOT_BEFORE);
    const profileHome = join(hermesHome, "profiles", "x");
    mkdirSync(profileHome, { recursive: true });
    writeFileSync(join(profileHome, "config.yaml"), "display:\n  skin: ares\n", "utf-8");
    activeHome = profileHome;
    process.env.HERMES_HOME = profileHome;

    const res = await putConfig("display", { show_cost: true });

    expect(res.status).toBe(200);
    expect(readFileSync(join(profileHome, "config.yaml"), "utf-8")).toContain("show_cost: true");
    expect(diskConfig()).toBe(ROOT_BEFORE);
    expect(mockUpdateAgentRoot).not.toHaveBeenCalled();
    expect(getAgentRoot().configYaml).toBe(ROOT_BEFORE);
  });

  it("GREEN CONTROL (5): the 409 refusal on an unparseable file never touches the row", async () => {
    seedRoot(MALFORMED, ROOT_BEFORE);

    const res = await putConfig("display", { show_cost: true });

    expect(res.status).toBe(409);
    expect(mockUpdateAgentRoot).not.toHaveBeenCalled();
    expect(getAgentRoot().configYaml).toBe(ROOT_BEFORE);
    expect(diskConfig()).toBe(MALFORMED);
  });
});

// ── D76 contract (2): the push keeps the save ───────────────────

describe("a root push after a Settings save", () => {
  it("(2) keeps show_cost on disk and in the row", async () => {
    // The defect as the operator met it: Save on Display, then any push of
    // Bob, then Show Cost is off again. Both halves are asserted because
    // finalize copies disk into the row at the end, so a push that reverted
    // the file would also revert the row and look internally consistent.
    seedRoot(ROOT_BEFORE);
    await putConfig("display", { show_cost: true });

    const result = pushRootToHermes();

    expect(result.error).toBeNull();
    expect(result.success).toBe(true);
    expect(diskDoc().display.show_cost).toBe(true);
    expect(getAgentRoot().configYaml).toContain("show_cost: true");
  });
});

// ── D78's drift line: the refresh carries a deletion too ────────

describe("PUT /api/config with a null value (D78) in the real loop", () => {
  it("removes the key from disk and the row together, so no drift wakes", async () => {
    seedRoot(ROOT_WITH_SHOW_COST);

    const res = await putConfig("display", { show_cost: null });

    expect(res.status).toBe(200);
    expect(diskConfig()).not.toContain("show_cost");
    expect(diskDoc().display).toEqual({ skin: "mono" });
    expect(getAgentRoot().configYaml).toBe(diskConfig());
    expect(detectRootDrift().fields).not.toContain("config.yaml");
  });
});

// ── D76 contract (6) to (9): the compare counts preserved sections ──

describe("configYamlSemanticallyMatches counts preserved sections", () => {
  const managed = "skills:\n  disabled: []\n";

  it("(6) a preserved value that differs is drift", () => {
    const disk = managed + "display:\n  show_cost: true\n";

    expect(configYamlSemanticallyMatches(disk, managed + "display:\n  show_cost: false\n")).toBe(
      false,
    );
    expect(configYamlSemanticallyMatches(disk, managed)).toBe(false);
  });

  it("GREEN CONTROL (7): key order and YAML formatting are not drift", () => {
    // The drift storm the design forbids (config-yaml-round-trips 'wakes no
    // false drift'): a hand-ordered file against the builder's fixed order.
    const disk = 'display:\n  show_cost: true\n  skin: "mono"\n' + managed;
    const assembled = managed + "display:\n  skin: mono\n  show_cost: true\n";

    expect(configYamlSemanticallyMatches(disk, assembled)).toBe(true);
  });

  it("GREEN CONTROL (8): the personality the builder injects into agent is not drift", () => {
    // buildConfigYaml writes agent.personality whenever an agent block exists.
    // A file without the line must still match, or every install with an
    // agent block and no personality is permanently Out of sync.
    const disk = managed + "agent:\n  max_turns: 100\n";
    const assembled = managed + "agent:\n  max_turns: 100\n  personality: technical\n";

    expect(configYamlSemanticallyMatches(disk, assembled)).toBe(true);
  });

  it("(9) detectRootDrift reports config.yaml when disk holds a preserved key the row lacks", () => {
    // A hand edit, or a writer that forgot to refresh: visible as drift now,
    // where before it was invisible right up to the push that erased it.
    seedRoot(ROOT_WITH_SHOW_COST, ROOT_BEFORE);

    const entry = detectRootDrift();

    expect(entry.fields).toContain("config.yaml");
    expect(entry.drifted).toBe(true);
  });
});

// ── D76 contract (10): the skills extras survive a rebuild ──────

describe("the non-managed children of skills survive parse and build", () => {
  it("(10) keeps creation_nudge_interval and external_dirs beside disabled", () => {
    // skills.creation_nudge_interval is the Skills section's only field, and
    // every root push used to drop it because the whole `skills` key is
    // managed. The DB's disabled list still wins (config-yaml-round-trips
    // pins that); the siblings ride along.
    const source = "skills:\n  disabled: []\n  creation_nudge_interval: 7\n  external_dirs:\n    - /x\n";

    const doc = yaml.load(buildConfigYaml(parseConfigYaml(source))) as {
      skills: Record<string, unknown>;
    };

    expect(doc.skills.creation_nudge_interval).toBe(7);
    expect(doc.skills.external_dirs).toEqual(["/x"]);
    expect(doc.skills.disabled).toEqual([]);
  });

  it("the managed children never ride along as extras: an `enabled` allowlist does not survive a rebuild", () => {
    // Sweep survivor `skills-extras-keep-managed`. `disabled` alone is safe
    // because buildConfigYaml assigns it after the spread, so the database
    // still wins; `enabled` and `platform_disabled` have no such assignment and
    // would be carried straight back out of the file they came from.
    const parts = parseConfigYaml(
      [
        "skills:",
        "  disabled:",
        "    - old/one",
        "  enabled:",
        "    - only/this",
        "  platform_disabled:",
        "    cli:",
        "      - x",
        "  creation_nudge_interval: 7",
        "",
      ].join("\n"),
    );

    expect(Object.keys(parts.skillsExtras ?? {})).toEqual(["creation_nudge_interval"]);
    const doc = yaml.load(buildConfigYaml({ ...parts, disabledSkills: ["ops/only-this"], platformDisabledSkills: {} })) as {
      skills: Record<string, unknown>;
    };
    expect(doc.skills.enabled).toBeUndefined();
    expect(doc.skills.platform_disabled).toBeUndefined();
    expect(doc.skills.disabled).toEqual(["ops/only-this"]);
  });

  it("the extras never enter preservedSections, and the DB's disabled list still wins", () => {
    // critique-config gap 6: carried as a preserved `skills` copy, the raw
    // disabled list would defeat the catalog normalisation and the file's
    // managed block would overwrite the database's.
    const parts = parseConfigYaml(
      "skills:\n  disabled:\n    - old/one\n  creation_nudge_interval: 7\n",
    );

    expect(parts.preservedSections.skills).toBeUndefined();
    const doc = yaml.load(buildConfigYaml({ ...parts, disabledSkills: ["ops/only-this"] })) as {
      skills: Record<string, unknown>;
    };
    expect(doc.skills.disabled).toEqual(["ops/only-this"]);
    expect(doc.skills.creation_nudge_interval).toBe(7);
  });
});
