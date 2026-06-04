/**
 * model-key — unit tests for the composite-key helpers used across
 * the model + fallback import routes.
 *
 * The byte-equivalence property is critical: each helper must
 * produce the same string as the inline template literal it replaces.
 */

import { fallbackKey, modelKey } from "@/lib/model-key";

describe("model-key: modelKey", () => {
  it("joins provider and modelId with ::", () => {
    expect(modelKey("openai", "gpt-4o")).toBe("openai::gpt-4o");
  });

  it("handles empty strings", () => {
    // Pre-refactor: `${"a"}::${""}` = "a::" — preserve.
    expect(modelKey("a", "")).toBe("a::");
    expect(modelKey("", "b")).toBe("::b");
    expect(modelKey("", "")).toBe("::");
  });

  it("preserves whitespace in either field", () => {
    // Pre-refactor: no trim. Inline form does not normalise.
    expect(modelKey("  openai  ", "  gpt-4o  ")).toBe("  openai  ::  gpt-4o  ");
  });

  it("is byte-equivalent to the inline template literal", () => {
    const cases: Array<[string, string]> = [
      ["openai", "gpt-4o"],
      ["anthropic", "claude-3-5-sonnet-20241022"],
      ["", ""],
      ["only-provider", ""],
      ["", "only-model"],
      ["has::separator", "in::model"],
    ];
    for (const [provider, modelId] of cases) {
      expect(modelKey(provider, modelId)).toBe(`${provider}::${modelId}`);
    }
  });
});

describe("model-key: fallbackKey", () => {
  it("joins provider and modelIdString with ::", () => {
    expect(fallbackKey("openai", "gpt-4o")).toBe("openai::gpt-4o");
  });

  it("produces the same string as modelKey for the same inputs", () => {
    // The 2 helpers exist for documentation at the call site — the
    // underlying separator + field order are identical. This test
    // locks that down so a future change to one helper is forced
    // to update the other.
    expect(fallbackKey("a", "b")).toBe(modelKey("a", "b"));
  });

  it("is byte-equivalent to the inline template literal", () => {
    const cases: Array<[string, string]> = [
      ["openai", "gpt-4o"],
      ["anthropic", "claude-3-5-sonnet-20241022"],
      ["", ""],
    ];
    for (const [provider, modelIdString] of cases) {
      expect(fallbackKey(provider, modelIdString)).toBe(
        `${provider}::${modelIdString}`,
      );
    }
  });
});
