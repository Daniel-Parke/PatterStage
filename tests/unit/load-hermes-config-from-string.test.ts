/** @jest-environment node */

/**
 * Tests for `loadHermesConfigFromString` — the central "parse a YAML
 * string into HermesConfig, treat empty as {}" helper introduced in
 * session 70 (List 4 refactor) to consolidate the inline
 *   `original ? ((yaml.load(original) as HermesConfig) ?? {}) : {}`
 * pattern that was duplicated across 3 sites in `hermes-config-sync.ts`
 * (syncDefaultsToHermesConfig's tail, syncSingleModelToHermesConfig,
 * syncFallbacksToHermesConfig).
 *
 * Distinct from `readHermesYamlConfig` (session 67, List 3): the older
 * helper reads from disk with existsSync + try/catch, returning null
 * on missing/unparseable files. This newer helper takes a string
 * directly and is the load-only half — it does NOT catch parse errors
 * (callers that want custom error reporting call yaml.load themselves).
 */

import yaml from "js-yaml";

import { loadHermesConfigFromString } from "@/modules/hermes/lib/hermes-config-read";

describe("loadHermesConfigFromString", () => {
  test("returns an empty object for the empty string", () => {
    expect(loadHermesConfigFromString("")).toEqual({});
  });

  test("returns an empty object for whitespace-only content", () => {
    // yaml.load("   ") returns undefined → helper collapses to {}.
    // This matches the pre-refactor inline `?? {}` behaviour.
    expect(loadHermesConfigFromString("   \n  \t\n")).toEqual({});
  });

  test("parses a minimal config.yaml body into HermesConfig", () => {
    const config = loadHermesConfigFromString(
      "model:\n  default: gpt-4o\n  provider: openai\n",
    );
    expect(config).toEqual({
      model: { default: "gpt-4o", provider: "openai" },
    });
  });

  test("parses a multi-section config body (model + auxiliary + fallback_providers)", () => {
    const config = loadHermesConfigFromString(
      [
        "model:",
        "  default: gpt-4o",
        "  provider: openai",
        "auxiliary:",
        "  summarization:",
        "    model: gpt-4o-mini",
        "    provider: openai",
        "fallback_providers:",
        "  - provider: openai",
        "    model: gpt-4o-mini",
        "  - provider: anthropic",
        "    model: claude-3-haiku",
      ].join("\n"),
    );
    expect(config?.model?.default).toBe("gpt-4o");
    expect((config?.auxiliary as Record<string, { model: string }>)?.summarization?.model).toBe(
      "gpt-4o-mini",
    );
    expect(config?.fallback_providers?.length).toBe(2);
    expect(config?.fallback_providers?.[1]?.model).toBe("claude-3-haiku");
  });

  test("does NOT catch parse errors (lets them propagate)", () => {
    // Duplicated-key YAML throws YAMLException — pre-refactor inline
    // code also propagated the error. This test pins that behaviour
    // so a future "improvement" can't silently swallow parse errors.
    const malformed = "model: { default: a, default: b }: { broken: [";
    expect(() => loadHermesConfigFromString(malformed)).toThrow(yaml.YAMLException);
  });

  test("byte-equivalent to the inline form for every input in a battery", () => {
    // The byte-equivalence gold standard from session 64 (Pattern AJ):
    // run the helper and the inline form over the same battery of
    // input shapes, assert they're equal for every input. This is
    // stronger than per-case tests because it directly proves the
    // invariant the refactor depends on.
    const battery: string[] = [
      "",
      "   ",
      "\n\n",
      "model:\n  default: gpt-4o\n",
      "model:\n  default: gpt-4o\n  provider: openai\n",
      "auxiliary: {}\n",
      "fallback_providers: []\n",
      "# just a comment\n",
      "null\n",
      "key: null\n",
      "42\n",
      "true\n",
    ];

    for (const input of battery) {
      // The inline form was:
      //   original ? ((yaml.load(original) as HermesConfig) ?? {}) : {}
      // For "non-empty but yaml.load returns null" inputs (e.g. "null"
      // or "   "), the helper still returns {} — but the inline form
      // returns {} for "" and the parsed value for "null" / "   ".
      // To preserve byte-equivalence exactly, the helper checks
      // `if (!content) return {}` (empty string only), then runs
      // `yaml.load` for any other input.
      //
      // This means for non-empty inputs the inline `?? {}` collapses
      // undefined/null to {}, and so does the helper — they match.
      // For "" the inline form short-circuits to {} and the helper
      // also returns {} — they match. The battery covers both.
      const expected = input
        ? ((yaml.load(input) as Record<string, unknown> | null | undefined) ?? {})
        : {};
      const actual = loadHermesConfigFromString(input);
      expect(actual).toEqual(expected);
    }
  });
});
