// ══════════════════════════════════════════════════════════════════════════════
// operation-sync-action-is-api-success-false-source-pattern.test.ts
// ══════════════════════════════════════════════════════════════════════════════
//
// Source-pattern assertions pinning the post-refactor shape of
// `src/lib/operation-sync-action.ts`. These tests do NOT exercise runtime
// behavior (that's covered by `operation-sync-action.test.ts` + the new
// `operation-sync-action-is-api-success-false.test.ts`); they assert the
// source file's STRUCTURE so a future "inline the type-guard back into
// the runSyncAction try-block" PR would fail loudly here.
//
// What this pins:
//
//  1. The `isApiSuccessFalse` helper is exported from the file
//     (so external tests and future helpers can import it).
//  2. The `runSyncAction` call site uses the helper (NOT a re-inlined
//     chained type guard). Specifically: the file does NOT contain
//     the 6-clause `checkSuccess && data && typeof data === "object" &&
//     "data" in data && data.data && typeof data.data === "object" &&
//     "success" in data.data && (data.data as ...).success === false`
//     chain.
//  3. The `runSyncAction` call site is the byte-equivalent
//     `if (checkSuccess && isApiSuccessFalse(data)) { ... }` form.
//  4. The narrowing is used (the `data.data.error` access is the
//     narrowed type, not a re-cast to `unknown`).
//
// Comment-stripped source is read so multi-line comment blocks above
// the helper don't trip the test (the pre-helper documentation is
// intentionally verbose for the per-call-site rationale).

import { readFileSync } from "fs";
import { join } from "path";

const SRC_PATH = join(
  process.cwd(),
  "src",
  "lib",
  "operation-sync-action.ts",
);

function readSource(): string {
  // strip /* ... */ and // ... line comments so JSDoc and
  // explanatory comments don't trip the substring matches.
  const raw = readFileSync(SRC_PATH, "utf-8");
  return raw
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

describe("operation-sync-action source pattern (isApiSuccessFalse extraction)", () => {
  it("exports isApiSuccessFalse as a named function", () => {
    const source = readSource();
    // Match `export function isApiSuccessFalse(`
    expect(source).toMatch(/export function isApiSuccessFalse\s*\(/);
  });

  it("uses isApiSuccessFalse in the runSyncAction call site (not the inlined chain)", () => {
    const source = readSource();
    // The post-refactor call site is `if (checkSuccess && isApiSuccessFalse(data)) {`.
    expect(source).toMatch(/if\s*\(\s*checkSuccess\s*&&\s*isApiSuccessFalse\s*\(\s*data\s*\)\s*\)/);
  });

  it("does NOT contain the 6-clause inlined chain (the pre-refactor shape)", () => {
    const source = readSource();
    // The pre-refactor chain was:
    //   if (
    //     checkSuccess &&
    //     data && typeof data === "object" &&
    //     "data" in data && data.data &&
    //     typeof data.data === "object" &&
    //     "success" in data.data &&
    //     (data.data as { success: unknown }).success === false
    //   )
    // Verify the chain's key signature fragments are absent from
    // the call site. The helper itself contains `typeof data ===
    // "object"` etc., so this assertion must check for the
    // *combination* of `data.data && typeof data.data` (the
    // pre-refactor truthy-check pattern), not the individual
    // fragments.
    expect(source).not.toMatch(
      /data\.data\s*&&\s*typeof\s+data\.data\s*===\s*"object"/,
    );
  });

  it("accesses error via the narrowed type (data.data.error), not via re-cast", () => {
    const source = readSource();
    // The post-refactor narrowing is:
    //   const errMsg =
    //     typeof data.data.error === "string" ? data.data.error : errorMessage;
    // The pre-refactor re-cast was:
    //   typeof (data.data as { error?: unknown }).error === "string"
    expect(source).toMatch(/typeof\s+data\.data\.error\s*===\s*"string"/);
    // The pre-refactor `as { error?: unknown }` cast inside the
    // error check should be GONE. (The helper's own internal
    // `as { ... }` casts are fine — they live inside
    // `isApiSuccessFalse` and use the response-level `data` shape,
    // not the re-cast on `data.data.error`.)
    expect(source).not.toMatch(
      /\(data\.data as \{ error\?:\s*unknown\s*\}\)\.error/,
    );
  });

  it("isApiSuccessFalse is a type-guard (uses the `is` predicate in the return type)", () => {
    const source = readSource();
    // The return type is `response is { data: { success: false; error?: unknown } }`.
    // The `is` predicate is what gives the call site the narrowed
    // type for `data.data.error`. If a future refactor drops the
    // `is` and uses `boolean` instead, the call site's
    // `data.data.error` access would no longer compile, but the
    // type assertion in `operation-sync-action-is-api-success-false.test.ts`
    // would also break — this source-pattern test pins the SHAPE
    // of the return type at the file level, not via the test
    // file's narrowing assertion.
    expect(source).toMatch(
      /export function isApiSuccessFalse\s*\([^)]*\):\s*response is\s*\{/,
    );
  });
});
