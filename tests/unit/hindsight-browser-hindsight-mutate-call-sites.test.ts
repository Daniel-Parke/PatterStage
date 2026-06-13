/**
 * @jest-environment node
 */
// Session 195 — List 1 (List 1 carryover from session 190) —
// `hindsightMutate` helper extraction in `HindsightBrowser.tsx`.
// The 4 inline `safeApiCall + toastFromResult` mutation handlers
// (handleToggleDirective, handleDeleteDirective, handleRefreshModel,
// handleDeleteModel) are now consolidated through the new
// `hindsightMutate` helper (src/lib/hindsight-mutate.ts).
//
// This test replaces the session 182
// `hindsight-toast-from-result-migration.test.ts` (which pinned the
// `toastFromResult`-in-4-handlers shape). The post-session-195
// shape is `hindsightMutate`-in-4-handlers + the helper owns the
// `toastFromResult` call internally.
//
// Source-pattern assertions:
//   (a) `hindsightMutate` is imported from `@/lib/hindsight-mutate`
//   (b) `safeApiCall` is NOT imported anymore (helper owns the call)
//   (c) `toastFromResult` is NOT imported anymore (helper composes it)
//   (d) exactly 4 `hindsightMutate(...)` call sites in the file
//   (e) no remaining `safeApiCall("/api/memory/hindsight"` calls
//   (f) the thunk form is preserved at site 1 (regex pin on
//       `() => (directive.is_active`)
//   (g) `setRefreshingModelId(id)` + the 2 `setRefreshingModelId(null)`
//       calls still present at site 3 (busy state preserved)
//   (h) no inline `if (!ok) { showToast(error ?? "Failed to X", "error")`
//       form anywhere in the 4 handler bodies (regression net for the
//       session 182 pre-form coming back via a different route)

import { readFileSync } from "fs";
import { join } from "path";

const HINDSIGHT_BROWSER = join(
  process.cwd(),
  "src/components/memory/HindsightBrowser.tsx",
);

const HANDLERS = [
  "handleToggleDirective",
  "handleDeleteDirective",
  "handleRefreshModel",
  "handleDeleteModel",
] as const;

describe("HindsightBrowser hindsightMutate migration (session 195, List 1)", () => {
  let rawSource: string;
  let codeOnlySource: string;

  beforeAll(() => {
    rawSource = readFileSync(HINDSIGHT_BROWSER, "utf-8");
    // Strip block + line comments so the negative assertions don't
    // false-positive on JSDoc that mentions the old pattern. Same
    // pre-filter as session 182 (this test's predecessor) and
    // session 172 P-1.
    codeOnlySource = rawSource
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
  });

  it("imports hindsightMutate from @/lib/hindsight-mutate", () => {
    expect(rawSource).toMatch(
      /import\s*\{\s*hindsightMutate\s*\}\s*from\s*["']@\/lib\/hindsight-mutate["']/,
    );
  });

  it("no longer imports safeApiCall (helper owns the wire call)", () => {
    // The 4 migrated sites were the only safeApiCall consumers in the
    // file. A regression that re-adds the import (e.g. for a new
    // mutation site that bypasses the helper) trips this assertion.
    expect(codeOnlySource).not.toMatch(/import\s*\{[^}]*safeApiCall[^}]*\}\s*from\s*["']@\/lib\/api-fetch["']/);
  });

  it("no longer imports toastFromResult (helper composes the call)", () => {
    // The 4 migrated sites were the only toastFromResult consumers in
    // the file. A regression that re-adds the import for a new
    // site that bypasses the helper trips this assertion.
    expect(codeOnlySource).not.toMatch(/import\s*\{[^}]*toastFromResult[^}]*\}\s*from\s*["']@\/lib\/toast-from-result["']/);
  });

  it.each(HANDLERS)(
    "%s calls hindsightMutate exactly once",
    (handlerName) => {
      const handlerIdx = codeOnlySource.indexOf(`const ${handlerName} =`);
      expect(handlerIdx).toBeGreaterThan(-1);
      // Slice only the handler body — bounded by the next
      // `const <name> =` declaration (the next handler in the
      // file). This prevents the 2nd `await hindsightMutate(` call
      // (which lives in the next handler) from being counted.
      const afterStart = codeOnlySource.slice(handlerIdx);
      const nextConstMatch = afterStart.slice(40).match(/\n  const \w+ =/);
      const bodyEnd = nextConstMatch
        ? handlerIdx + 40 + (nextConstMatch.index ?? 0)
        : codeOnlySource.length;
      const window = codeOnlySource.slice(handlerIdx, bodyEnd);
      const callCount = (window.match(/await\s+hindsightMutate\s*\(/g) || []).length;
      expect(callCount).toBe(1);
    },
  );

  it("has no remaining `safeApiCall(\"/api/memory/hindsight\"` calls in the file", () => {
    // Belt-and-suspenders: even if the import check above misses a
    // path that imports safeApiCall from a re-export, this catches
    // any inline call shape.
    expect(codeOnlySource).not.toMatch(/safeApiCall\s*\(\s*["']\/api\/memory\/hindsight["']/);
  });

  it("handleToggleDirective preserves the thunk form for the dynamic success message", () => {
    const handlerIdx = codeOnlySource.indexOf("const handleToggleDirective =");
    expect(handlerIdx).toBeGreaterThan(-1);
    const window = codeOnlySource.slice(handlerIdx, handlerIdx + 1200);
    // The success message depends on `directive.is_active` (read at
    // toast time, not at call time) — the helper's `() => string`
    // thunk form is the only way to express this. A regression to a
    // static string would lose the activated-vs-deactivated
    // distinction.
    expect(window).toMatch(
      /hindsightMutate\s*\(\s*showToast\s*,\s*["']POST["']\s*,\s*\{[^}]*is_active[^}]*\}\s*,\s*\(\)\s*=>/,
    );
  });

  it("handleRefreshModel preserves the busy state (setRefreshingModelId id + 2x null)", () => {
    // The pre-form set `setRefreshingModelId(id)` before the call
    // and reset to `null` on both the failure and success paths. The
    // `hindsightMutate` migration does NOT add a busy state (the
    // helper is a 1-shot call without try/catch) — the 3
    // `setRefreshingModelId(...)` calls stay inline.
    //
    // 1500 chars covers the handler body's last
    // `setRefreshingModelId(null)` (line 355) which is ~1190 chars
    // from the handler start (line 341). 1500 is a generous
    // headroom.
    const handlerIdx = codeOnlySource.indexOf("const handleRefreshModel =");
    expect(handlerIdx).toBeGreaterThan(-1);
    const window = codeOnlySource.slice(handlerIdx, handlerIdx + 1500);
    const setRefreshingCalls = (window.match(/setRefreshingModelId\s*\(/g) || []).length;
    expect(setRefreshingCalls).toBe(3);
  });

  it.each(HANDLERS)(
    "%s no longer uses the inline `showToast(error ?? \"...\", \"error\")` form",
    (handlerName) => {
      const handlerIdx = codeOnlySource.indexOf(`const ${handlerName} =`);
      expect(handlerIdx).toBeGreaterThan(-1);
      const window = codeOnlySource.slice(handlerIdx, handlerIdx + 1200);
      // Regression net for the session 182 pre-form coming back via
      // a different route (e.g. a new mutation site that bypasses
      // the helper). All 4 sites are now `hindsightMutate` consumers
      // — the helper owns the showToast-error call.
      expect(window).not.toMatch(/showToast\s*\(\s*error\s*\?\?\s*["']Failed to/);
    },
  );
});
