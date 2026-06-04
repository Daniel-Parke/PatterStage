/**
 * parse-bag-flags — unit tests for the string/boolean bag-of-flags
 * narrowers used across the sync/* and similar multi-action routes.
 *
 * The byte-equivalence property is critical: every helper here must
 * produce the same output as the inline form
 *
 *   typeof body.X === "string" ? body.X : undefined
 *   body.X === true
 *
 * for every input. The "narrow on type" tests below lock that down.
 */

import { booleanFlag, stringFlag } from "@/lib/parse-bag-flags";

describe("parse-bag-flags: stringFlag", () => {
  it("returns the value when it is a string", () => {
    expect(stringFlag({ name: "foo" }, "name")).toBe("foo");
  });

  it("returns the empty string when it is a string", () => {
    // Pre-refactor: typeof "" === "string" → returns "". Preserve.
    expect(stringFlag({ name: "" }, "name")).toBe("");
  });

  it("returns undefined when the key is missing", () => {
    expect(stringFlag({}, "name")).toBeUndefined();
  });

  it("returns undefined for non-string types", () => {
    expect(stringFlag({ name: 42 }, "name")).toBeUndefined();
    expect(stringFlag({ name: true }, "name")).toBeUndefined();
    expect(stringFlag({ name: null }, "name")).toBeUndefined();
    expect(stringFlag({ name: undefined }, "name")).toBeUndefined();
    expect(stringFlag({ name: {} }, "name")).toBeUndefined();
    expect(stringFlag({ name: [] }, "name")).toBeUndefined();
    expect(stringFlag({ name: ["a"] }, "name")).toBeUndefined();
  });

  it("returns the raw value when trim is not requested", () => {
    // Pre-refactor: the inline form does NOT trim, so a value with
    // surrounding whitespace must round-trip unchanged.
    expect(stringFlag({ name: "  foo  " }, "name")).toBe("  foo  ");
  });

  it("trims the value when trim is requested", () => {
    expect(stringFlag({ name: "  foo  " }, "name", { trim: true })).toBe("foo");
  });

  it("returns undefined for non-string values even when trim is requested", () => {
    expect(stringFlag({ name: 42 }, "name", { trim: true })).toBeUndefined();
  });

  it("is byte-equivalent to the inline form for every input", () => {
    // The "byte-equivalence to the inline form" test — if this ever
    // fails, the helper has drifted from the inline form, which is
    // the byte-equivalence contract for this refactor.
    const cases: Array<Record<string, unknown>> = [
      {},
      { name: "foo" },
      { name: "" },
      { name: "  spaced  " },
      { name: 0 },
      { name: 1 },
      { name: false },
      { name: true },
      { name: null },
      { name: undefined },
      { name: {} },
      { name: { nested: "yes" } },
      { name: [] },
      { name: ["a"] },
    ];
    for (const body of cases) {
      const inline =
        typeof body.name === "string" ? body.name : undefined;
      expect(stringFlag(body, "name")).toBe(inline);
    }
  });
});

describe("parse-bag-flags: booleanFlag", () => {
  it("returns true when the value is the boolean literal true", () => {
    expect(booleanFlag({ all: true }, "all")).toBe(true);
  });

  it("returns false for the boolean literal false", () => {
    // Strict `=== true`: pre-refactor `body.all === true` rejects
    // `false`. Preserve.
    expect(booleanFlag({ all: false }, "all")).toBe(false);
  });

  it("returns false when the key is missing", () => {
    expect(booleanFlag({}, "all")).toBe(false);
  });

  it("returns false for non-boolean truthy values", () => {
    // Truthy strings, numbers, etc. are NOT accepted — matches the
    // `body.X === true` strictness of the inline form.
    expect(booleanFlag({ all: "true" }, "all")).toBe(false);
    expect(booleanFlag({ all: 1 }, "all")).toBe(false);
    expect(booleanFlag({ all: "yes" }, "all")).toBe(false);
    expect(booleanFlag({ all: {} }, "all")).toBe(false);
    expect(booleanFlag({ all: [] }, "all")).toBe(false);
  });

  it("is byte-equivalent to the inline form for every input", () => {
    const cases: Array<Record<string, unknown>> = [
      {},
      { all: true },
      { all: false },
      { all: "true" },
      { all: "" },
      { all: 0 },
      { all: 1 },
      { all: null },
      { all: undefined },
      { all: [] },
      { all: ["a"] },
    ];
    for (const body of cases) {
      const inline = body.all === true;
      expect(booleanFlag(body, "all")).toBe(inline);
    }
  });
});
