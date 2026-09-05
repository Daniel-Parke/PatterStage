// ══════════════════════════════════════════════════════════════════════════════
// isApiSuccessFalse — type-guard for the `data.data?.success === false`
// envelope produced by the /api/agent/profiles/sync/* endpoints
// ══════════════════════════════════════════════════════════════════════════════
//
// Extracted from `runSyncAction` in `src/lib/operation-sync-action.ts`.
// The pre-extraction shape was a 6-clause chained type guard inside
// `runSyncAction`'s try-block. Promoting it to a named type-guard gives
// us:
//
//   1. A self-contained test surface — every reachable input shape
//      can be asserted without spinning up a `runSyncAction` call
//      (no apiFetch mock, no setBusy/setToast spies, no async ordering).
//   2. TypeScript narrowing — once the guard returns `true`, the
//      `error` property is typed `string | undefined` (rather than
//      `unknown`), so the `errMsg` extraction in `runSyncAction` no
//      longer needs the inner `typeof ... === "string"` check.
//   3. Pinning the byte-equivalence — these tests verify the helper
//      covers the exact input shapes the inlined chain did, no more,
//      no less. A future "let's also accept `success: 0` as failure"
//      extension would have to consciously update both the helper
//      and these tests.
//
// Shape coverage (mirrors the inlined chain's truth table):
//
//   | input                                  | expected result |
//   |----------------------------------------|-----------------|
//   | { data: { success: false, error: "x" }}| true (narrowed) |
//   | { data: { success: false, error: 42 } }| true (no narrow) |
//   | { data: { success: false } }            | true (no error) |
//   | { data: { success: true } }            | false           |
//   | { data: { success: "false" } }          | false (strict)  |
//   | { data: {} }                            | false           |
//   | { }                                     | false           |
//   | null                                    | false           |
//   | undefined                               | false           |
//   | "string"                                | false           |
//   | 42                                      | false           |
//   | []                                      | false (no data) |
//   | { data: null }                          | false           |
//   | { data: "string" }                      | false           |
//   | { data: { success: false, error: null } }| true (no narrow) |

import { isApiSuccessFalse } from "@/lib/operation-sync-action";

describe("isApiSuccessFalse", () => {
  describe("positive cases (returns true)", () => {
    it("returns true for { data: { success: false, error: 'disk full' }}", () => {
      const result = isApiSuccessFalse({
        data: { success: false, error: "disk full" },
      });
      expect(result).toBe(true);
    });

    it("returns true for { data: { success: false } } (no error key)", () => {
      const result = isApiSuccessFalse({ data: { success: false } });
      expect(result).toBe(true);
    });

    it("returns true for { data: { success: false, error: 42 } } (non-string error)", () => {
      // The helper doesn't pre-validate the error shape — that's
      // the caller's job (runSyncAction's `typeof data.data.error
      // === "string"` check). The guard just confirms the success
      // envelope.
      const result = isApiSuccessFalse({
        data: { success: false, error: 42 },
      });
      expect(result).toBe(true);
    });

    it("returns true for { data: { success: false, error: null } }", () => {
      const result = isApiSuccessFalse({
        data: { success: false, error: null },
      });
      expect(result).toBe(true);
    });

    it("returns true for { data: { success: false, extra: 'keys' } } (extra fields ignored)", () => {
      const result = isApiSuccessFalse({
        data: { success: false, extra: "keys", cronPushError: "y" },
      });
      expect(result).toBe(true);
    });
  });

  describe("negative cases (returns false)", () => {
    it("returns false for { data: { success: true } }", () => {
      expect(isApiSuccessFalse({ data: { success: true } })).toBe(false);
    });

    it("returns false for { data: { success: 'false' } } (strict equality)", () => {
      // The pre-helper chain used `=== false` (strict), so the
      // string "false" is NOT considered a failure. Pin this
      // behavior — a future "lenient" relaxation would have to
      // consciously update both the helper and this test.
      expect(isApiSuccessFalse({ data: { success: "false" } })).toBe(false);
    });

    it("returns false for { data: { success: 0 } } (strict equality)", () => {
      expect(isApiSuccessFalse({ data: { success: 0 } })).toBe(false);
    });

    it("returns false for { data: {} } (no success key)", () => {
      expect(isApiSuccessFalse({ data: {} })).toBe(false);
    });

    it("returns false for { } (no data key)", () => {
      expect(isApiSuccessFalse({})).toBe(false);
    });

    it("returns false for null", () => {
      expect(isApiSuccessFalse(null)).toBe(false);
    });

    it("returns false for undefined", () => {
      expect(isApiSuccessFalse(undefined)).toBe(false);
    });

    it("returns false for a string", () => {
      expect(isApiSuccessFalse("error")).toBe(false);
    });

    it("returns false for a number", () => {
      expect(isApiSuccessFalse(42)).toBe(false);
    });

    it("returns false for an array (no 'data' key on arrays)", () => {
      // Arrays are objects in JS, so `typeof [] === "object"`
      // returns true — but `"data" in []` is also true
      // (inherited from Object.prototype? No, actually it would be
      // false because Array doesn't have a "data" property). Either
      // way, the guard should reject arrays. Verify the array
      // case explicitly so the chained guards are not silently
      // bypassed by a future "use Object.keys" refactor.
      expect(isApiSuccessFalse([])).toBe(false);
    });

    it("returns false for { data: null }", () => {
      // The pre-helper chain had `data.data &&` (truthy check),
      // so `data: null` is correctly rejected. The helper's
      // explicit `!== null` preserves this.
      expect(isApiSuccessFalse({ data: null })).toBe(false);
    });

    it("returns false for { data: 'string' } (non-object data)", () => {
      expect(isApiSuccessFalse({ data: "string" })).toBe(false);
    });

    it("returns false for { data: 42 } (numeric data)", () => {
      expect(isApiSuccessFalse({ data: 42 })).toBe(false);
    });

    it("returns false for { data: { success: undefined } }", () => {
      // `success: undefined` is treated as "not false" — the
      // success check is the strict `=== false` test, so undefined
      // doesn't trigger the failure path.
      expect(isApiSuccessFalse({ data: { success: undefined } })).toBe(
        false,
      );
    });
  });

  describe("type narrowing (the `is` predicate)", () => {
    it("narrowed response exposes typed `data.success === false` and `data.error`", () => {
      // This is a TypeScript-only assertion — if the `is` predicate
      // doesn't narrow correctly, `data.data.success` would be
      // `boolean | undefined` and the `=== false` check would not
      // narrow `error` to `string | undefined`. The runtime side
      // is a no-op; the test exists to catch predicate regressions
      // at compile time.
      const response: unknown = {
        data: { success: false, error: "narrowed" },
      };
      if (isApiSuccessFalse(response)) {
        // Inside the `if`, the type system knows:
        //   response.data is { success: false; error?: unknown }
        // so the following lines compile only when the predicate
        // is correct.
        expect(response.data.success).toBe(false);
        expect(response.data.error).toBe("narrowed");
      } else {
        throw new Error("expected isApiSuccessFalse to narrow to true");
      }
    });

    it("rejects `success: true` in the narrowed block (negative type test)", () => {
      // Negative companion: confirm the narrowed-out branch's
      // type is unknown. We never access response.data inside the
      // else branch (because the type is unknown), so this test
      // is purely structural — it documents the call-site
      // expectation that `isApiSuccessFalse` is the SINGLE
      // condition gating access to `data.data.error`.
      const response: unknown = { data: { success: true, error: "ignored" } };
      const result = isApiSuccessFalse(response);
      if (result) {
        // This branch is unreachable for the input — if the guard
        // is wrong, the test will fail at runtime.
        throw new Error(
          `isApiSuccessFalse should have returned false for success:true, got ${result}`,
        );
      }
      expect(result).toBe(false);
    });
  });
});
