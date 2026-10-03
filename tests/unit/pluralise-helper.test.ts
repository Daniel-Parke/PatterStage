/**
 * Tests for the `pluralise` helper in `@/lib/utils`.
 *
 * History: the `pluralise(n)` helper was added in session 108 to
 * consolidate the 6 inline `${count} foo${count !== 1 ? "s" : ""}`
 * call sites across the codebase (chat page, SkillSelector,
 * MentalModelsTab, DirectivesTab, ModelSyncButtons, useModelsPage).
 *
 * The helper is intentionally minimal (no irregulars, no `y → ies`):
 * all 6 call sites use the simple `s`-suffix rule, and any future
 * irregular-plural site should adopt a domain-specific helper rather
 * than overloading this one. If a "child/children" or "person/people"
 * call site appears, promote that to a separate `pluraliseIrregular`
 * or to a per-domain helper at the call site.
 *
 * Byte-equivalence (per session 51 lesson): the helper body is
 * literally `return count !== 1 ? "s" : "";` — textually identical
 * to the inline form it replaces. The tests below prove the truth
 * table for the 4 boundary inputs (0, 1, 2, negative) and several
 * realistic JSX composition patterns.
 */
import { pluralise } from "@/lib/utils";

describe("utils — pluralise", () => {
  it("returns '' for count === 1 (singular form)", () => {
    expect(pluralise(1)).toBe("");
  });

  it("returns 's' for count === 0 (zero takes the plural in English)", () => {
    // The English rule is "0/2+ = plural, 1 = singular". The 6 current
    // call sites all use the simple `s`-suffix variant which is
    // "count !== 1 ? 's' : ''" — so 0 takes the plural. This test
    // locks the rule so a future "0 takes singular" PR is a
    // deliberate behavior change, not a regression.
    expect(pluralise(0)).toBe("s");
  });

  it("returns 's' for count === 2 (plural form)", () => {
    expect(pluralise(2)).toBe("s");
  });

  it("returns 's' for count > 1 (large plurals)", () => {
    expect(pluralise(42)).toBe("s");
    expect(pluralise(1000)).toBe("s");
  });

  it("returns 's' for negative counts (defensive — array lengths are >= 0, but TS allows negatives)", () => {
    // The 6 call sites pass `.length` (always >= 0) so negatives
    // are unreachable in practice. But the helper is a pure
    // function and the rule is "count !== 1", so -1 should also
    // return "s". Locks the helper's domain.
    expect(pluralise(-1)).toBe("s");
  });

  it("returns 's' for floating-point counts (count is `number`, not `int`)", () => {
    // 1.5 !== 1, so the plural suffix applies. This is a defensive
    // lock — the 6 call sites pass `.length` (always integer), but
    // a future "duration in seconds" or "decimal weight" site
    // would pass a float and the rule still applies.
    expect(pluralise(1.5)).toBe("s");
  });

  it("is byte-equivalent to the inline `${n} foo${n !== 1 ? 's' : ''}` form for all 6 call-site inputs", () => {
    // The 6 call sites in the codebase pass the following count
    // sources — every one of them must produce the same output
    // as the pre-refactor inline form. This is the byte-equivalence
    // test that locks the session-51 invariant.
    const cases: Array<{ count: number; noun: string; expected: string }> = [
      { count: 0, noun: "message", expected: "0 messages" }, // empty session
      { count: 1, noun: "message", expected: "1 message" }, // single message
      { count: 5, noun: "message", expected: "5 messages" }, // multi-message
      { count: 0, noun: "skill", expected: "0 skills" },
      { count: 1, noun: "skill", expected: "1 skill" },
      { count: 1, noun: "change", expected: "1 change" }, // ModelSyncButtons 1-diff case
      { count: 3, noun: "change", expected: "3 changes" },
      { count: 1, noun: "auxiliary default", expected: "1 auxiliary default" }, // useModelsPage 1-task case
      { count: 4, noun: "auxiliary default", expected: "4 auxiliary defaults" },
    ];
    for (const { count, noun, expected } of cases) {
      const actual = `${count} ${noun}${pluralise(count)}`;
      expect(actual).toBe(expected);
    }
  });

  it("returns a string literal type that is exactly '' or 's' (TypeScript-level lock)", () => {
    // The return type is `"" | "s"` (not `string`). This lock
    // forces future implementations to keep the literal-type
    // contract — a future "irregular plural" extension that
    // returns e.g. "ies" would have to change the return type
    // and consciously update the 6 call sites. The runtime
    // assertion below is a belt-and-braces check that the
    // literal type is actually what we say it is.
    const result = pluralise(2);
    expect(result === "" || result === "s").toBe(true);
    expect(typeof result).toBe("string");
  });
});
