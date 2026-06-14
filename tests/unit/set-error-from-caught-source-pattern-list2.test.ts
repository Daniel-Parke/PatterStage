/**
 * @jest-environment node
 *
 * Source-pattern test for the `setX(messageFromError(err, fallback))`
 * → `setErrorFromCaught(setX, err, fallback)` migration in List 2.
 *
 * **The pattern we want to pin: every `useState<string | null>`
 * error setter in List 2 hooks/hooks-adjacent files that wraps a
 * caught error must go through `setErrorFromCaught` from
 * `@/lib/api-fetch`.** The helper composes `messageFromError()`
 * with the setter so the call site reads
 * `setErrorFromCaught(setX, err, "...")` instead of the 2-hop
 * `setX(messageFromError(err, "..."))` form.
 *
 * **List 2 surface (per session 178):**
 *   - `src/hooks/useMissionsPage.ts` — the 1 surviving
 *     `setCategoryError(messageFromError(...))` site at
 *     `loadCategories` (line 393, post-migration). Sister sites in
 *     the same file: `loadCategories` (1 setter, 1 toast), and the
 *     2 fetch-failure sites in `fetchData`/`fetchDetail` that were
 *     `console.error`-only (now also `toastError`-surfaced for
 *     parity with the sibling `fetchTemplates` site).
 *
 * **Why a per-list source-pattern test.** The List 1 test
 * (`set-error-from-caught-source-pattern-list1.test.ts`) covers the
 * 4 page-local List 1 files + the layout-shared Sidebar. The
 * List 1.5 Sidebar discovery in session 176 explicitly carved out
 * layout-shared components as a 5th surface. The List 2 pick in
 * session 178 closed the carryover that the control-hub skill's
 * "next carryover candidate (List 2)" pitfall called out — this
 * test pins the post-migration shape so a future regression on
 * the missions hook (e.g. a copy-paste from a pre-session-178
 * commit) trips the same test.
 *
 * **Pre-flight recipe (run BEFORE any future migration into a
 * different setter name in this file):**
 *
 *   # 1. Confirm the helper is exported with the right signature
 *   rg -n "export function setErrorFromCaught" src/lib/api-fetch.ts
 *   # Should show: setErrorFromCaught(setError: SetErrorFn, err: unknown, fallback: string)
 *
 *   # 2. Confirm no other call site in the file uses the inline form
 *   rg -n "setCategoriesLoadError\(messageFromError" src/hooks/useMissionsPage.ts
 *   # Should show: 0 matches (post-session-178 invariant)
 *
 * @see src/lib/api-fetch.ts — `setErrorFromCaught` (the helper)
 * @see src/hooks/useMissionsPage.ts — the List 2 hook that contained the 1 site
 */

import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..");
const USE_MISSIONS_PAGE_PATH = join(REPO_ROOT, "src", "hooks", "useMissionsPage.ts");
// `loadCategories` (the setErrorFromCaught migration site) was extracted into
// the `useMissionCategories` hook, so the import + call-site assertions target
// that file now.
const USE_MISSION_CATEGORIES_PATH = join(REPO_ROOT, "src", "hooks", "useMissionCategories.ts");
const HELPER_PATH = join(REPO_ROOT, "src", "lib", "api-fetch.ts");

const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

describe("setErrorFromCaught envelope migration — List 2 useMissionsPage hook", () => {
  const rawSource = readFileSync(USE_MISSIONS_PAGE_PATH, "utf8");
  const categoriesRaw = readFileSync(USE_MISSION_CATEGORIES_PATH, "utf8");
  const categoriesCodeOnly = stripComments(categoriesRaw);
  // Strip line + block comments before scanning. The post-migration
  // file has a JSDoc-style migration note in the `loadCategories`
  // catch block that literally mentions the old
  // `setCategoriesLoadError(messageFromError(...))` form — that's
  // explanatory text, not executable code, and would false-positive
  // the "does NOT contain" assertion. Same JSDoc-vs-code
  // pre-filter as the session-172 agents route test
  // (`agents-route-server-error-from-catch-source-pattern.test.ts`).
  const codeOnlySource = rawSource
    .replace(/\/\*[\s\S]*?\*\//g, "") // /* ... */ block comments
    .replace(/\/\/.*$/gm, ""); // // ... line comments

  // The structural pattern we want to forbid at the call site:
  // `setX(messageFromError(...))` where X is a useState<string | null>
  // setter (setCategoriesLoadError, setError, etc.).
  const FORBIDDEN_INLINE_SETX_MESSAGFROMERROR = /set\w+\(\s*messageFromError\s*\(/g;

  it("the useMissionsPage source file is readable", () => {
    expect(rawSource.length).toBeGreaterThan(0);
  });

  it("the useMissionsPage source is a real .ts file on disk", () => {
    const stat = statSync(USE_MISSIONS_PAGE_PATH);
    expect(stat.isFile()).toBe(true);
    expect(USE_MISSIONS_PAGE_PATH.endsWith(".ts")).toBe(true);
  });

  it("setErrorFromCaught is exported from @/lib/api-fetch with the right signature", () => {
    const helperSource = readFileSync(HELPER_PATH, "utf8");
    // The helper must take a setter + an unknown + a fallback. If the
    // signature changes (e.g. add a 4th param), this test fails and
    // the migration's byte-equivalence claim needs re-verification.
    // Tolerate trailing commas (TS formatted style). Session 178
    // enhanced the helper to return `string` (was `void`) for
    // dual-dispatch (state + toast) callers — the return-type
    // assertion pins that contract.
    expect(helperSource).toMatch(
      /export\s+function\s+setErrorFromCaught\s*\(\s*setError\s*:\s*SetErrorFn\s*,\s*err\s*:\s*unknown\s*,\s*fallback\s*:\s*string\s*,?\s*\)\s*:\s*string/,
    );
    // And the body must compose messageFromError with the setter
    // and return the resolved message.
    expect(helperSource).toMatch(
      /const\s+msg\s*=\s*messageFromError\s*\(\s*err\s*,\s*fallback\s*\)/,
    );
    expect(helperSource).toMatch(/setError\s*\(\s*msg\s*\)/);
    expect(helperSource).toMatch(/return\s+msg\s*;?/);
  });

  it("useMissionsPage does NOT use `setX(messageFromError(...))` at any call site", () => {
    // The byte-equivalent inline form bypasses the helper. We want
    // 0 matches in user-land (i.e. anywhere in the file outside
    // comments/JSDoc). The migration should leave the file with
    // `setErrorFromCaught` calls only.
    const matches = codeOnlySource.match(FORBIDDEN_INLINE_SETX_MESSAGFROMERROR) ?? [];
    expect(matches).toHaveLength(0);
  });

  it("useMissionCategories imports setErrorFromCaught and uses it for the loadCategories migration", () => {
    // Belt-and-suspenders: the helper should actually be imported by the
    // category hook (where loadCategories now lives). A hook that doesn't
    // import setErrorFromCaught is broken (either the migration was reverted,
    // or the inline form came back via a copy-paste).
    expect(categoriesRaw).toMatch(
      /import\s*\{[^}]*\bsetErrorFromCaught\b[^}]*\}\s*from\s*["']@\/lib\/api-fetch["']/,
    );
    // And the call site uses it with the canonical args. The dual-
    // dispatch shape is `setErrorFromCaught(setCategoriesLoadError, error, "...")`
    // — the helper returns the resolved message for the
    // follow-on showToast(msg, "error") call.
    expect(categoriesCodeOnly).toMatch(
      /\bsetErrorFromCaught\s*\(\s*setCategoriesLoadError\s*,\s*error\s*,\s*["']Failed to load categories["']/,
    );
  });

  it("useMissionsPage no longer imports messageFromError (zero remaining call sites)", () => {
    // After the migration, messageFromError is unused in the
    // hook file. A re-introduction of an inline 2-hop call site
    // would also re-import the helper — this assertion pins the
    // "no remaining stale imports" invariant (same shape as the
    // List 1 Sidebar test).
    expect(rawSource).not.toMatch(
      /import\s*\{[^}]*\bmessageFromError\b[^}]*\}\s*from\s*["']@\/lib\/api-fetch["']/,
    );
  });

  it("the fetchData missions-fetch catch surfaces via toastError (no silent console.error)", () => {
    // Session 178 also fixed the `console.error("Failed to load
    // missions:", error)` site that was the only catch-block
    // without user-facing error reporting. The three fetch slices
    // in `fetchData` (missions, categories, templates) and the
    // `fetchDetail` panel all surface failures via `toastError`
    // (or `setErrorFromCaught` for the categories slice that has
    // a `setCategoriesLoadError` state setter). This assertion
    // pins the `toastError(showToast, error, "Failed to load missions")`
    // shape so a future regression to silent-fail is caught.
    expect(codeOnlySource).toMatch(
      /toastError\s*\(\s*showToast\s*,\s*error\s*,\s*["']Failed to load missions["']/,
    );
    expect(codeOnlySource).toMatch(
      /toastError\s*\(\s*showToast\s*,\s*error\s*,\s*["']Failed to load mission detail["']/,
    );
  });
});
