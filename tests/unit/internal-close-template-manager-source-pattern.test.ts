/** @jest-environment node */

/**
 * Source-pattern test for the 3 internal `setShowTemplateManager(false)`
 * sites in `useMissionsPage.ts` that were migrated to use the hook's
 * stable `closeTemplateManager` callback in session 211.
 *
 * Background: the `useMissionsPage` hook defines `closeTemplateManager`
 * (a `useCallback(() => setShowTemplateManager(false), [])` at line
 * 443-445) and exposes it on the returned `vm` object so the page's
 * `<TemplateManagerModal onClose={closeTemplateManager}>` JSX binding
 * has a single source of truth. Pre-session-211, the hook's 3 internal
 * useCallback bodies (`handleCreateNewTemplate`, `handleEditTemplate`,
 * `handleDeleteTemplate`) inlined the raw `setShowTemplateManager
 * (false)` call — 3 sites that could drift from the JSX binding's
 * close-callback path if a future "also clear the template filter" or
 * "also reset template category" extension was added to the JSX side.
 *
 * The session 211 migration is byte-equivalent: the callback body still
 * calls `setShowTemplateManager(false)`, and the 3 internal sites now
 * go through the callback. A future extension to `closeTemplateManager`
 * (e.g. `setTemplateFilter("all")`) automatically lands in all 3
 * internal sites + the JSX onClose — no risk of one path skipping the
 * reset.
 *
 * The sister test `missions-modal-close-callbacks-source-pattern.test.ts`
 * (session 206) already pins the public shape of `closeTemplateManager`:
 *   - hook declares it as a `useCallback(() => setShowTemplateManager
 *     (false), [])` (the body still has the raw setter call — that's
 *     the canonical close-modal shim)
 *   - hook exposes it on the `vm` return
 *   - page re-exports it as `const closeTemplateManager =
 *     vm.closeTemplateManager;`
 *   - page does NOT have a local useCallback that calls
 *     `setShowTemplateManager(false)`
 *
 * This file is the **internal-site** sister test that pins the
 * 3-internal-site migration. The 2 tests are complementary:
 *   - `missions-modal-close-callbacks-source-pattern.test.ts` —
 *     public API shape (hook + page binding)
 *   - `internal-close-template-manager-source-pattern.test.ts` —
 *     internal hook useCallback body shape (3 sites that go through
 *     the callback, not the raw setter)
 *
 * What the test pins:
 *   1. Each of the 3 internal useCallbacks (`handleCreateNewTemplate`,
 *      `handleEditTemplate`, `handleDeleteTemplate`) calls
 *      `closeTemplateManager()` — NOT `setShowTemplateManager(false)`.
 *   2. Each affected useCallback's deps array now includes
 *      `closeTemplateManager` (the linter requires the dep, even
 *      though the callback reference is stable across renders).
 *   3. Outside the `closeTemplateManager` body, no code calls
 *      `setShowTemplateManager(false)` — the 3 sites are the only
 *      `closeTemplateManager` call sites in the hook.
 *   4. The `openTemplateManager` body still calls
 *      `setShowTemplateManager(true)` (not migrated — `open` and
 *      `close` are different setters; the test pins the asymmetry).
 */
import { readFileSync } from "fs";
import { join } from "path";

const REPO_ROOT = join(__dirname, "..", "..");
const useMissionsPagePath = join(
  REPO_ROOT,
  "src",
  "hooks",
  "useMissionsPage.ts",
);

describe("useMissionsPage internal sites migrated to closeTemplateManager (session 211)", () => {
  const hookSource = readFileSync(useMissionsPagePath, "utf-8");

  // Strip block + line comments so JSDoc prose that documents the
  // pre-refactor form doesn't inflate the "raw setShowTemplateManager
  // (false) outside the body" count. The 3 pre-session-211 JSDoc
  // comments at the migrated sites document the pre-refactor form
  // (e.g. "this site inlined `setShowTemplateManager(false)` directly")
  // for the regression guard.
  const stripComments = (text: string): string =>
    text
      .replace(/\/\*[\s\S]*?\*\//g, "/* */") // block comments (incl. JSDoc)
      .replace(/^\s*\/\/.*$/gm, ""); // line comments

  describe("3 internal useCallback sites migrated to closeTemplateManager()", () => {
    it("handleCreateNewTemplate calls closeTemplateManager() (not the raw setter)", () => {
      // Find the useCallback body. The pre-refactor form was
      // `setShowTemplateManager(false); setShowTemplateEditor(true);`
      // The post-refactor form is
      // `closeTemplateManager(); setShowTemplateEditor(true);`.
      const match = hookSource.match(
        /const\s+handleCreateNewTemplate\s*=\s*useCallback\(\s*\(\s*\)\s*=>\s*\{([\s\S]*?)\}\s*,\s*\[([^\]]*)\]\s*,?\s*\)/,
      );
      expect(match).not.toBeNull();
      // Strip block + line comments from the captured body so the
      // JSDoc prose that documents the pre-refactor form doesn't
      // trigger a false positive on the negative assertion.
      const body = stripComments(match![1]);
      // Positive: closeTemplateManager is called.
      expect(body).toMatch(/closeTemplateManager\(\)/);
      // Negative: the raw setter is NOT in the body.
      expect(body).not.toMatch(/setShowTemplateManager\(false\)/);
      // Deps include closeTemplateManager.
      expect(match![2]).toMatch(/closeTemplateManager/);
    });

    it("handleEditTemplate calls closeTemplateManager() (not the raw setter)", () => {
      const match = hookSource.match(
        /const\s+handleEditTemplate\s*=\s*useCallback\(\s*\(\s*t\s*:\s*MissionTemplate\s*\)\s*=>\s*\{([\s\S]*?)\}\s*,\s*\[([^\]]*)\]\s*,?\s*\)/,
      );
      expect(match).not.toBeNull();
      const body = stripComments(match![1]);
      expect(body).toMatch(/closeTemplateManager\(\)/);
      expect(body).not.toMatch(/setShowTemplateManager\(false\)/);
      expect(match![2]).toMatch(/closeTemplateManager/);
    });

    it("handleDeleteTemplate calls closeTemplateManager() (not the raw setter)", () => {
      const match = hookSource.match(
        /const\s+handleDeleteTemplate\s*=\s*useCallback\(\s*async\s*\(\s*templateId\s*:\s*string\s*\)\s*=>\s*\{([\s\S]*?)\}\s*,\s*\[([^\]]*)\]\s*,?\s*\)/,
      );
      expect(match).not.toBeNull();
      const body = stripComments(match![1]);
      expect(body).toMatch(/closeTemplateManager\(\)/);
      expect(body).not.toMatch(/setShowTemplateManager\(false\)/);
      expect(match![2]).toMatch(/closeTemplateManager/);
    });
  });

  describe("global: 0 raw setShowTemplateManager(false) sites outside the callback body", () => {
    it("the only setShowTemplateManager(false) call is inside closeTemplateManager's body", () => {
      // The session 211 refactor leaves exactly 1 raw setter call:
      // the body of `closeTemplateManager` (the canonical close-modal
      // shim, line 443-445). All 3 internal hook call sites +
      // the page's JSX onClose binding go through this single
      // callback. A regression that re-introduces an inline
      // `setShowTemplateManager(false)` would skip the callback
      // and miss any future "also reset template filter" extension.
      const stripped = stripComments(hookSource);
      const matches = stripped.match(/setShowTemplateManager\(false\)/g);
      expect(matches).not.toBeNull();
      expect(matches!.length).toBe(1);
    });

    it("setShowTemplateManager(true) still exists (open path is not migrated)", () => {
      // The `openTemplateManager` callback body still calls
      // `setShowTemplateManager(true)`. The session 211 refactor
      // only touches the close direction (3 internal sites +
      // the callback body). A regression that accidentally removed
      // the open setter call would break the "Edit Templates" button
      // in the MissionsList.
      const stripped = stripComments(hookSource);
      const matches = stripped.match(/setShowTemplateManager\(true\)/g);
      expect(matches).not.toBeNull();
      expect(matches!.length).toBe(1);
    });
  });

  describe("closeTemplateManager call sites (positive count)", () => {
    it("hook calls closeTemplateManager in exactly 3 internal sites", () => {
      // The 3 internal sites (`handleCreateNewTemplate`,
      // `handleEditTemplate`, `handleDeleteTemplate`) each call
      // `closeTemplateManager()` once. The 4th occurrence is the
      // callback's own definition site (`const closeTemplateManager
      // = useCallback(...)`). Use a regex that matches the
      // function-call form (with trailing `()`) and excludes the
      // definition site (which has `= useCallback` after the name).
      const stripped = stripComments(hookSource);
      const callMatches =
        stripped.match(/closeTemplateManager\(\)/g) ?? [];
      expect(callMatches.length).toBe(3);
    });

    it("hook defines closeTemplateManager as a useCallback (definition site, not a call)", () => {
      // The definition site has the `useCallback(` keyword after the
      // name. The 3 call sites are bare `closeTemplateManager()`
      // (no `useCallback` follow). Assert the definition is still a
      // useCallback (no regression that turned it into a function
      // literal).
      expect(hookSource).toMatch(
        /const\s+closeTemplateManager\s*=\s*useCallback\(/,
      );
    });
  });

  describe("List 2 surface sanity for the internal-migration", () => {
    it("the hook file is readable (regression guard)", () => {
      expect(hookSource.length).toBeGreaterThan(0);
    });
  });
});
