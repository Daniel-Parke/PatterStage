/**
 * @jest-environment node
 */
// Session 182 — List 1 audit (HindsightBrowser) source-pattern lock for the
// `toastFromResult` migration in the 4 inline
//   if (!ok) { showToast(error ?? "Failed to X", "error"); return; }
//   showToast("Success", "success");
// handlers (handleToggleDirective, handleDeleteDirective,
// handleRefreshModel, handleDeleteModel).
//
// `toastFromResult(showToast, result, successMsg, errorFallback)` is the
// canonical pattern that collapses the 3-line guard into a single call.
// The `successMsg: string | (() => string)` thunk form (added in session 75
// for the dispatch-mission flow) supports the dynamic success message in
// `handleToggleDirective` (deactivated vs activated).
//
// Migration shape — pre (4 sites):
//
//   const { ok, error } = await safeApiCall(...);
//   if (!ok) {
//     showToast(error ?? "Failed to X", "error");
//     return;
//   }
//   showToast("Success", "success");
//   ...
//
// Post:
//
//   const result = await safeApiCall(...);
//   toastFromResult(showToast, result, "Success", "Failed to X");
//   if (!result.ok) return;
//   ...
//
// This test pins the post-migration source shape so a future regression
// that re-introduces the inline `if (!ok) { showToast(error ?? "...", "error"); return; }`
// form trips the source pattern scanner.

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

describe("HindsightBrowser toastFromResult migration (session 182, List 1)", () => {
  let rawSource: string;
  let codeOnlySource: string;

  beforeAll(() => {
    rawSource = readFileSync(HINDSIGHT_BROWSER, "utf-8");
    // Strip block + line comments so the negative assertions don't
    // false-positive on JSDoc that mentions the old pattern. Same pre-filter
    // as session 172 P-1 (control-hub skill) and the
    // `safe-api-call-data-source-pattern-list1-logs` test.
    codeOnlySource = rawSource
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
  });

  it("imports toastFromResult from @/lib/toast-from-result", () => {
    expect(rawSource).toMatch(
      /import\s*\{\s*toastFromResult\s*\}\s*from\s*["']@\/lib\/toast-from-result["']/,
    );
  });

  it.each(HANDLERS)(
    "%s calls toastFromResult (not the inline showToast(error ?? ..., 'error') form)",
    (handlerName) => {
      // Match the handler body up to the next handler or closing brace of
      // the component. The regex is intentionally narrow — it just needs
      // to confirm the handler is calling toastFromResult, not the old
      // inline form.
      const handlerIdx = codeOnlySource.indexOf(`const ${handlerName} =`);
      expect(handlerIdx).toBeGreaterThan(-1);
      // Look ahead 1000 chars for the helper call within the handler.
      const window = codeOnlySource.slice(handlerIdx, handlerIdx + 1000);
      expect(window).toMatch(/toastFromResult\s*\(/);
    },
  );

  it.each(HANDLERS)(
    "%s no longer uses the inline `showToast(error ?? \"...\", \"error\")` form",
    (handlerName) => {
      const handlerIdx = codeOnlySource.indexOf(`const ${handlerName} =`);
      expect(handlerIdx).toBeGreaterThan(-1);
      const window = codeOnlySource.slice(handlerIdx, handlerIdx + 1000);
      // The negative assertion: the old `showToast(error ?? "Failed to X", "error")`
      // pattern should not appear in the handler body. (It can still appear
      // in the `loadDirectives` / `loadModels` error branches which pre-date
      // the migration — those are out of scope for this audit.)
      expect(window).not.toMatch(/showToast\s*\(\s*error\s*\?\?\s*["']Failed to/);
    },
  );

  it("handleToggleDirective uses the thunk form for the dynamic success message", () => {
    const handlerIdx = codeOnlySource.indexOf("const handleToggleDirective =");
    expect(handlerIdx).toBeGreaterThan(-1);
    const window = codeOnlySource.slice(handlerIdx, handlerIdx + 1000);
    // The success message depends on `directive.is_active` (read at toast
    // time, not at call time) — the helper's `() => string` thunk form is
    // the only way to express this. A regression to a static string would
    // lose the activated-vs-deactivated distinction.
    expect(window).toMatch(
      /toastFromResult\s*\(\s*showToast\s*,\s*result\s*,\s*\(\)\s*=>/,
    );
  });
});
