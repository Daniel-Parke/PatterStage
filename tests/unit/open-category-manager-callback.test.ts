/** @jest-environment node */

/**
 * Source-pattern test for the `openCategoryManager` open-callback sibling in
 * src/app/orchestration/missions/page.tsx and src/hooks/useMissionsPage.ts.
 *
 * Session 116 P-7 promoted inline `() => setShowX(true)` arrows next to
 * a `closeX` callback to a named `openX` callback (the open/close sibling
 * pattern). Session 118 applied that pattern to the missions page's
 * `closeCategoryManager` + inline `onManageCategories={() =>
 * setShowCategoryManager(true)}` pair — the inline open arrow was promoted
 * to a `useCallback`-wrapped `openCategoryManager` callback named next to
 * its `closeCategoryManager` sibling.
 *
 * The helper lives in the `useMissionsPage` hook (so the same callback is
 * reused by `MissionsList`'s "Manage categories" button and the page's
 * `<MissionCreateForm>`'s `onManageCategories` prop). The page re-exports
 * it as `const openCategoryManager = vm.openCategoryManager;` so the
 * JSX in the page can reference it without the `vm.` indirection.
 *
 * The helper is a 1-setter useCallback that opens the category manager
 * modal:
 *
 *   setShowCategoryManager(true);
 *
 * Same byte-equivalent shape as the sibling `closeCategoryManager`
 * (`setShowCategoryManager(false)`) and the cron page's
 * `openAgentCreate` / `openSystemCreate` callbacks (sessions 101, 114),
 * and the dashboard page's `openDispatchPanel` callback (session 118).
 *
 * This test is intentionally source-pattern based (rather than rendering
 * the page) for two reasons:
 *
 *  1. The byte-equivalence claim is about the *shape* of the helper
 *     (which setter it calls, with which value), not about React's
 *     `useCallback` behaviour. Source-pattern tests lock the shape
 *     invariant without coupling to React internals.
 *  2. Importing the page would require a full Next.js render harness
 *     (AppPageShell + sidebar providers), which is overkill for a
 *     1-setter pure function.
 *
 * The test also locks the call-site invariants:
 *   - The 1 inline `() => setShowCategoryManager(true)` arrow is gone
 *     from both the page and the MissionsList
 *   - The page consumes the helper as `openCategoryManager` (re-exported
 *     from the hook)
 *   - The page threads it to the `onManageCategories` prop
 *   - The MissionsList threads it to the "Manage categories" button's
 *     `onClick`
 *   - The sibling `closeCategoryManager` is also a `useCallback` with
 *     `[]` deps (matching pattern from cron page's `closeAgentModal`)
 *   - The hook itself declares `openCategoryManager` as a `useCallback`
 *     with `[]` deps and exposes it on the returned `vm` object
 *
 * If a future session removes `openCategoryManager` or re-introduces the
 * inline `() => setShowCategoryManager(true)` form, this test fails.
 */
import { readFileSync } from "fs";
import { join } from "path";

const REPO_ROOT = join(__dirname, "..", "..");
const missionsPagePath = join(
  REPO_ROOT,
  "src",
  "app",
  "orchestration",
  "missions",
  "page.tsx",
);
const missionsListPath = join(
  REPO_ROOT,
  "src",
  "components",
  "missions",
  "MissionsList.tsx",
);
const useMissionsPagePath = join(
  REPO_ROOT,
  "src",
  "hooks",
  "useMissionsPage.ts",
);

describe("openCategoryManager open-callback sibling (missions page)", () => {
  const pageSource = readFileSync(missionsPagePath, "utf-8");
  const listSource = readFileSync(missionsListPath, "utf-8");
  const hookSource = readFileSync(useMissionsPagePath, "utf-8");

  it("hook declares openCategoryManager as a useCallback that calls setShowCategoryManager(true)", () => {
    // Lock the helper body in the hook (where it lives, so the same
    // callback is reused by MissionsList + MissionCreateForm). The
    // same setter as closeCategoryManager, but with `true` instead of
    // `false`. The regex uses the `s` flag (dot-matches-newline) so
    // the multi-line `useCallback(() => { setShowCategoryManager(true); }, [])`
    // body shape is matched. The optional `,?\s*` before the closing
    // `)` handles the trailing comma between `[]` (the deps array)
    // and the useCallback's closing paren.
    expect(hookSource).toMatch(
      /const\s+openCategoryManager\s*=\s*useCallback\(\s*\(\s*\)\s*=>\s*\{?\s*setShowCategoryManager\(true\)\s*;?\s*\}?\s*,\s*\[[^\]]*\]\s*,?\s*\)/s,
    );
  });

  it("hook uses empty deps array for openCategoryManager (useState setters are stable)", () => {
    // Extract the openCategoryManager declaration from the hook and
    // assert the deps array is empty. The setter reference is stable
    // across renders (useState returns a stable identity), so the
    // callback is also stable — matching the sibling close callbacks.
    // Multi-line body shape handled via the `s` flag. The optional
    // `,?\s*` before the closing `)` handles the trailing comma
    // between the deps array and the useCallback's closing paren.
    const match = hookSource.match(
      /const\s+openCategoryManager\s*=\s*useCallback\(\s*\(\s*\)\s*=>\s*\{?\s*setShowCategoryManager\(true\)\s*;?\s*\}?\s*,\s*(\[[^\]]*\])\s*,?\s*\)/s,
    );
    expect(match).not.toBeNull();
    expect(match![1].trim()).toBe("[]");
  });

  it("hook exposes openCategoryManager on the returned vm object", () => {
    // The page destructures `vm.openCategoryManager` and the list
    // destructures `openCategoryManager` from the vm prop. Both rely
    // on the hook exposing the callback as a property of the returned
    // object. Pin the property is present in the return-statement
    // shape used by the hook (the session 118 carryover documents the
    // return shape; see the `openCategoryManager` line in the
    // `return { ... }` block at the bottom of useMissionsPage.ts).
    // Match the property name on its own line (no required comment).
    expect(hookSource).toMatch(
      /^\s*openCategoryManager\s*,?\s*$/m,
    );
  });

  it("page re-exports openCategoryManager from vm (so JSX can reference it without vm. indirection)", () => {
    // The page does `const openCategoryManager = vm.openCategoryManager;`
    // to lift the helper out of the vm so the JSX in the page
    // (specifically the `onManageCategories={openCategoryManager}` prop
    // on `<MissionCreateForm>`) doesn't have to use `vm.openCategoryManager`
    // — matches the `closeCategoryManager` declaration (which is
    // defined locally in the page, not on the vm).
    expect(pageSource).toMatch(
      /const\s+openCategoryManager\s*=\s*vm\.openCategoryManager\s*;/,
    );
  });

  it("hook declares closeCategoryManager as a useCallback that calls setShowCategoryManager(false) (sibling of openCategoryManager)", () => {
    // The sibling `closeCategoryManager` was promoted from the page to
    // the hook in this session (sister to the existing
    // `openCategoryManager` callback). The test pins the same
    // shape as the open callback: `useCallback(() => {
    // setShowCategoryManager(false); }, [])` with `[]` deps (the
    // setter is stable, matching the open callback's deps). The page
    // re-exports it as `const closeCategoryManager = vm.closeCategoryManager;`
    // so the JSX can reference it without the `vm.` indirection.
    expect(hookSource).toMatch(
      /const\s+closeCategoryManager\s*=\s*useCallback\(\s*\(\s*\)\s*=>\s*\{?\s*setShowCategoryManager\(false\)\s*;?\s*\}?\s*,\s*\[[^\]]*\]\s*,?\s*\)/s,
    );
  });

  it("hook uses empty deps array for closeCategoryManager (useState setters are stable)", () => {
    // The setter is stable across renders so `[]` is correct. The
    // open callback uses the same shape.
    const match = hookSource.match(
      /const\s+closeCategoryManager\s*=\s*useCallback\(\s*\(\s*\)\s*=>\s*\{?\s*setShowCategoryManager\(false\)\s*;?\s*\}?\s*,\s*(\[[^\]]*\])\s*,?\s*\)/s,
    );
    expect(match).not.toBeNull();
    expect(match![1].trim()).toBe("[]");
  });

  it("hook exposes closeCategoryManager on the returned vm object", () => {
    // The page destructures `vm.closeCategoryManager` for the
    // `<CategoryManagerModal>` `onClose` prop. Pin the property is
    // present in the hook's return-statement shape.
    expect(hookSource).toMatch(
      /^\s*closeCategoryManager\s*,?\s*$/m,
    );
  });

  it("page re-exports closeCategoryManager from vm (so JSX can reference it without vm. indirection)", () => {
    // The page does `const closeCategoryManager = vm.closeCategoryManager;`
    // to lift the helper out of the vm so the JSX in the page
    // (specifically the `onClose={closeCategoryManager}` prop on
    // `<CategoryManagerModal>`) doesn't have to use `vm.closeCategoryManager`.
    // Mirrors the open-callback re-export pattern above.
    expect(pageSource).toMatch(
      /const\s+closeCategoryManager\s*=\s*vm\.closeCategoryManager\s*;/,
    );
  });

  it("page does NOT have a local closeCategoryManager useCallback declaration (moved to hook)", () => {
    // The page-local `useCallback(() => setShowCategoryManager(false), [setShowCategoryManager])`
    // form has been replaced by `const closeCategoryManager = vm.closeCategoryManager;`.
    // A regression that re-introduces the page-local form would
    // shadow the hook's callback and break the symmetric open/close
    // pair pattern.
    expect(pageSource).not.toMatch(
      /const\s+closeCategoryManager\s*=\s*useCallback\(\s*\(\s*\)\s*=>\s*setShowCategoryManager\(false\)/,
    );
  });

  it("replaces the inline () => setShowCategoryManager(true) arrow on onManageCategories", () => {
    // The page must NOT contain the inline `() => setShowCategoryManager(true)`
    // form on the `onManageCategories` prop. The session 118 refactor
    // replaced it with the named `openCategoryManager` callback.
    expect(pageSource).not.toMatch(
      /onManageCategories=\{\(\)\s*=>\s*setShowCategoryManager\(true\)\}/,
    );
  });

  it("page consumes the helper as openCategoryManager (passed to onManageCategories)", () => {
    // The named callback must be threaded to the `onManageCategories`
    // prop on `<MissionCreateForm>`. Lock the call-site shape.
    expect(pageSource).toMatch(/onManageCategories=\{openCategoryManager\}/);
  });

  it("MissionsList consumes the helper as openCategoryManager (passed to Manage categories button onClick)", () => {
    // The MissionsList "Manage categories" button must also use the
    // named callback (not the inline `() => setShowCategoryManager(true)`
    // arrow). Lock the call-site shape on the list.
    expect(listSource).toMatch(
      /onClick=\{openCategoryManager\}/,
    );
  });

  it("MissionsList does NOT have the inline () => setShowCategoryManager(true) arrow on the Manage categories button", () => {
    // The list must NOT contain the inline form either. The session 118
    // refactor moved the inline arrow out of the list too — both
    // call sites now share the named `openCategoryManager` callback
    // from the hook's `vm` object.
    expect(listSource).not.toMatch(
      /onClick=\{\(\)\s*=>\s*setShowCategoryManager\(true\)\}/,
    );
  });

  it("imports useCallback from react (required for the new callback)", () => {
    // The page now uses `useCallback` to wrap the 3 close callbacks +
    // the new `openCategoryManager`. The import must be present or the
    // build fails. This test pins the import statement so a future
    // "remove unused imports" sweep doesn't accidentally drop it.
    expect(pageSource).toMatch(/import\s*\{\s*useCallback\s*\}\s*from\s*["']react["']/);
  });
});
