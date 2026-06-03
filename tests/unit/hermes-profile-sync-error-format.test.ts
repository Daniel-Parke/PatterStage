/**
 * hermes-profile-sync-error-format — byte-equivalence tests for the
 * `messageFromError(err, "")` migration.
 *
 * The 7 catch blocks in `src/lib/hermes-profile-sync.ts` previously
 * had the inline form
 *
 *   const message = err instanceof Error ? err.message : String(err);
 *
 * This session migrated them to the existing `messageFromError` helper
 * from `@/lib/api-fetch`:
 *
 *   const message = messageFromError(err, "");
 *
 * The `""` fallback is byte-equivalent to the inline form for every
 * realistic input:
 *
 *   - Error("foo")        → inline: "foo"  / helper: "foo"  (truthy msg)
 *   - new Error("")       → inline: ""     / helper: ""     (empty msg || "")
 *   - "string throw"      → inline: String  / helper: String  (non-Error → toError wraps, msg is String(err), truthy)
 *   - 42                  → inline: "42"    / helper: "42"
 *   - null                → inline: "null"  / helper: "null"
 *   - new TypeError(...)  → inline: subclass msg / helper: subclass msg
 *
 * The helper's `|| fallback` discipline only activates when `err.message`
 * is empty — exactly the case the inline form also returns "" for. So
 * the migration is a name change, not a behavior change.
 *
 * This test pins the equivalence for the 6 input shapes that could
 * realistically reach a catch block in `hermes-profile-sync.ts`.
 */

import { messageFromError, toError } from "@/lib/api-fetch";

describe("hermes-profile-sync error format byte-equivalence", () => {
  // Inline form (pre-migration)
  const inline = (err: unknown): string =>
    err instanceof Error ? err.message : String(err);

  // Helper form (post-migration)
  const helper = (err: unknown): string => messageFromError(err, "");

  const cases: Array<[string, unknown]> = [
    ["Error with message", new Error("disk full")],
    ["Error with empty message", new Error("")],
    ["string throw", "permission denied"],
    ["null throw", null],
    ["number throw", 42],
    ["TypeError subclass", new TypeError("bad path")],
  ];

  test.each(cases)(
    "inline and helper produce identical output for %s",
    (_name, err) => {
      expect(helper(err)).toBe(inline(err));
    },
  );

  // Verify the helper composes toError correctly (regression guard).
  test("toError coerces non-Error via String()", () => {
    expect(toError(42).message).toBe("42");
    expect(toError(null).message).toBe("null");
    expect(toError(undefined).message).toBe("undefined");
    expect(toError("oops").message).toBe("oops");
  });

  // Sanity: empty Error stays empty under both forms (this is the
  // load-bearing case for the `|| ""` choice).
  test("empty Error returns empty string under both inline and helper", () => {
    const err = new Error("");
    expect(helper(err)).toBe("");
    expect(inline(err)).toBe("");
  });
});
