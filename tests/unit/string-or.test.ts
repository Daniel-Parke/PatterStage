/**
 * Unit tests for `stringOr` from
 * src/components/memory/hindsight/utils.ts.
 *
 * `stringOr(value, fallback?)` centralises the
 *   typeof x === "string" ? x : fallback
 * pattern that appears in HindsightBrowser.tsx (and 6+ other files
 * in the codebase per the session-86 audit) when reading a payload
 * field that may be absent or non-string. The migration is
 * byte-equivalent at runtime — the helper is the inline form, with
 * the type guard and the `||` default extracted.
 *
 * The tests lock:
 *   - The no-fallback overload returns `string | undefined`
 *   - The with-fallback overload returns `string` (narrowed)
 *   - Strings round-trip verbatim
 *   - null / undefined / number / boolean / object / array inputs
 *     all fall through to the fallback (or `undefined` if none)
 *   - Empty string is a valid string (not treated as missing)
 *   - The function does not coerce: a number that "looks like" a
 *     string is still a number and is rejected
 */
import { stringOr } from "@/components/memory/hindsight/utils";

describe("stringOr", () => {
  describe("no-fallback overload", () => {
    it("returns the string when the input is a string", () => {
      expect(stringOr("hello")).toBe("hello");
    });

    it("returns undefined for null", () => {
      expect(stringOr(null)).toBeUndefined();
    });

    it("returns undefined for undefined", () => {
      expect(stringOr(undefined)).toBeUndefined();
    });

    it("returns undefined for a number", () => {
      expect(stringOr(42)).toBeUndefined();
    });

    it("returns undefined for a boolean", () => {
      expect(stringOr(true)).toBeUndefined();
    });

    it("returns undefined for an object", () => {
      expect(stringOr({ x: 1 })).toBeUndefined();
    });

    it("returns undefined for an array", () => {
      expect(stringOr(["a", "b"])).toBeUndefined();
    });

    it("preserves the empty string (does not coerce to undefined)", () => {
      // The inline `typeof x === "string" ? x : undefined` form
      // returns "" for an empty string input, and so does stringOr.
      // Treating "" as "missing" would silently drop empty-but-
      // intentional values like `message: ""` in a payload.
      expect(stringOr("")).toBe("");
    });
  });

  describe("with-fallback overload", () => {
    it("returns the string when the input is a string", () => {
      expect(stringOr("hello", "fallback")).toBe("hello");
    });

    it("returns the fallback for null", () => {
      expect(stringOr(null, "fallback")).toBe("fallback");
    });

    it("returns the fallback for undefined", () => {
      expect(stringOr(undefined, "fallback")).toBe("fallback");
    });

    it("returns the fallback for a number", () => {
      expect(stringOr(42, "fallback")).toBe("fallback");
    });

    it("returns the fallback for an object", () => {
      expect(stringOr({ x: 1 }, "fallback")).toBe("fallback");
    });

    it("preserves an empty-string input over a non-empty fallback", () => {
      // The inline form does the same: `typeof "" === "string" ? "" : "fallback"`
      // returns "". This is the byte-equivalence contract.
      expect(stringOr("", "fallback")).toBe("");
    });
  });

  describe("byte-equivalence with the inline pattern", () => {
    it("matches the inline form for every JS value type", () => {
      // The migration of HindsightBrowser lines 109/137 was the use
      // case. The literal inline form is:
      //   typeof x === "string" ? x : fallback
      // The helper is the same expression with the type guard and
      // the || extracted. The assertion below is mechanical: for
      // every input, both forms must return the same string.
      const inputs: unknown[] = [
        "hello",
        "",
        null,
        undefined,
        0,
        42,
        false,
        true,
        { x: 1 },
        ["a"],
        Symbol("s"),
      ];
      for (const x of inputs) {
        const inline = typeof x === "string" ? x : "fb";
        const helper = stringOr(x, "fb");
        expect(helper).toBe(inline);
      }
    });
  });
});
