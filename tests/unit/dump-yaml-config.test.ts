// ══════════════════════════════════════════════════════════════════════════════
// dump-yaml-config — unit tests for the dumpYamlConfig helper
// ══════════════════════════════════════════════════════════════════════════════
//
// Locks the byte-for-byte contract of `dumpYamlConfig(value)` against the
// pre-refactor inline form `yaml.dump(value, { lineWidth: -1, noRefs: true })`.
// The helper replaced 5 inline call sites across `src/lib/hermes-config-sync.ts`
// (3), `src/app/api/config/route.ts` (1), and `src/lib/profile-config-builder.ts`
// (1). All 5 sites produced the same string before the refactor and must
// produce the same string after.
// ══════════════════════════════════════════════════════════════════════════════

import * as yaml from "js-yaml";

import { dumpYamlConfig } from "@/lib/yaml-config";

describe("dumpYamlConfig", () => {
  it("matches yaml.dump with lineWidth: -1, noRefs: true for a flat object", () => {
    const value = { name: "alice", age: 30, active: true };
    expect(dumpYamlConfig(value)).toBe(
      yaml.dump(value, { lineWidth: -1, noRefs: true }),
    );
  });

  it("matches the inline form for a deeply nested object", () => {
    const value = {
      model: { provider: "openai", model: "gpt-4o", context_length: 128000 },
      auxiliary: {
        embedding: { provider: "openai", model: "text-embedding-3-small" },
      },
      agent: { personality: "default", api_max_retries: 3 },
    };
    expect(dumpYamlConfig(value)).toBe(
      yaml.dump(value, { lineWidth: -1, noRefs: true }),
    );
  });

  it("emits no YAML anchors or aliases for repeated objects (noRefs: true)", () => {
    // The same object referenced twice would normally emit `&a001` and `*a001`
    // anchors. The PatterStage config.yaml style never uses these — the pre-
    // refactor form had `noRefs: true` and the helper must preserve that.
    const shared = { provider: "openai", model: "gpt-4o" };
    const value = { primary: shared, secondary: shared };
    const out = dumpYamlConfig(value);
    expect(out).not.toMatch(/&/);
    expect(out).not.toMatch(/\*/);
    // And the same string as the inline form
    expect(out).toBe(
      yaml.dump(value, { lineWidth: -1, noRefs: true }),
    );
  });

  it("does not wrap long lines (lineWidth: -1)", () => {
    // A string longer than js-yaml's default 80-char lineWidth must NOT be
    // wrapped. The inline form's `lineWidth: -1` is what the pre-refactor
    // config.yaml writers depended on (long URLs, long env values).
    const longUrl = "https://api.example.com/v1/models/very-long-model-name/versions/12345";
    const out = dumpYamlConfig({ url: longUrl });
    expect(out).toBe(yaml.dump({ url: longUrl }, { lineWidth: -1, noRefs: true }));
    expect(out).toContain(longUrl); // present verbatim
    // No "..." or ">- " fold-style wrapping
    expect(out).not.toMatch(/^url: >-/m);
  });

  it("serializes arrays of primitives", () => {
    const value = { skills: ["web_search", "code_execution", "file_io"] };
    expect(dumpYamlConfig(value)).toBe(
      yaml.dump(value, { lineWidth: -1, noRefs: true }),
    );
  });

  it("serializes arrays of objects (preserves key order in each element)", () => {
    const value = {
      profiles: [
        { name: "alpha", role: "primary" },
        { name: "beta", role: "fallback" },
      ],
    };
    expect(dumpYamlConfig(value)).toBe(
      yaml.dump(value, { lineWidth: -1, noRefs: true }),
    );
  });

  it("handles null and undefined fields (matches js-yaml default)", () => {
    const value = { a: null, b: undefined, c: 0, d: "", e: false };
    expect(dumpYamlConfig(value)).toBe(
      yaml.dump(value, { lineWidth: -1, noRefs: true }),
    );
  });

  it("preserves UTF-8 / unicode strings verbatim (no escaping)", () => {
    const value = { name: "中文-αβγ", emoji: "🦊" };
    const out = dumpYamlConfig(value);
    expect(out).toContain("中文-αβγ");
    expect(out).toContain("🦊");
    expect(out).toBe(yaml.dump(value, { lineWidth: -1, noRefs: true }));
  });

  it("emits a string ending in a single trailing newline (the js-yaml default)", () => {
    // All 4 pre-refactor call sites wrote the result to a file or pipeline
    // that expected the trailing newline. The helper must preserve that.
    const out = dumpYamlConfig({ a: 1 });
    expect(out.endsWith("\n")).toBe(true);
  });

  it("handles a top-level scalar (string-only value)", () => {
    // The 5 migrated sites all pass objects, but the helper accepts any
    // yaml.dump-acceptable value. This locks the type-safety contract.
    expect(dumpYamlConfig("just a string")).toBe(
      yaml.dump("just a string", { lineWidth: -1, noRefs: true }),
    );
  });

  it("handles an empty object (edge case the profile-config-builder.ts site exercises)", () => {
    // `buildPreservedYamlLines` calls dumpYamlConfig({ [key]: value }) where
    // `value` may be `undefined` for keys not present in the input. js-yaml
    // serializes `undefined` as the literal string "undefined" — preserve
    // that pre-refactor behavior.
    const out = dumpYamlConfig({ key: undefined });
    expect(out).toBe(
      yaml.dump({ key: undefined }, { lineWidth: -1, noRefs: true }),
    );
  });
});
