/** @jest-environment node */

/**
 * Source-pattern test for the 3 missions-modal close-callbacks that were
 * promoted from `src/app/orchestration/missions/page.tsx` to the
 * `useMissionsPage` hook in this session.
 *
 * Background: the missions page had 3 page-local `useCallback(() =>
 * setX(false), [setX])` definitions for the `<CategoryManagerModal>`,
 * `<TemplateManagerModal>`, and `<TemplateEditorModal>` `onClose` props.
 * The hook (`useMissionsPage.ts`) already exposed the 3 corresponding
 * `openX` callbacks as siblings of the page's local close callbacks
 * (e.g. `openCategoryManager` was added in session 118 as the open
 * sibling of the page-local `closeCategoryManager`).
 *
 * This session's refactor promoted the 3 close callbacks into the hook
 * so the open/close pair sits next to each other in the hook's return
 * value, matching the `openCreate` / `closeComposer` pattern that
 * session 98 established. The page re-exports them as
 * `const closeX = vm.closeX;` so the JSX can reference them without
 * the `vm.` indirection.
 *
 * The 3 promoted callbacks:
 *   - `closeCategoryManager` — `() => setShowCategoryManager(false)`
 *     (sibling of the existing `openCategoryManager` from session 118)
 *   - `closeTemplateManager` — `() => setShowTemplateManager(false)`
 *     (sibling of the existing `openTemplateManager` from session 118)
 *   - `closeTemplateEditor` — `() => setShowTemplateEditor(false)`
 *     (SOFT close — the editor's HARD 2-setter `cancelTemplateEditor`
 *     stays page-local; the SOFT close is the symmetric open/close pair
 *     sibling of the editor's inline open paths in
 *     `handleCreateNewTemplate` / `handleEditTemplate`)
 *
 * What the test pins:
 *   1. Each close callback is declared in the hook (not the page) as a
 *      `useCallback` that calls the right `setShowX(false)` setter.
 *   2. Each close callback has `[]` deps (matching the open-callback
 *      shape — the setter is stable across renders).
 *   3. Each close callback is exposed on the hook's returned `vm` object
 *      so the page can destructure it.
 *   4. The page re-exports each as `const closeX = vm.closeX;` for JSX
 *      ergonomics (mirrors the `openCategoryManager` re-export pattern).
 *   5. The page does NOT have a local `useCallback(() => setShowX(false))`
 *      form for any of the 3 callbacks (regression guard — a future
 *      "moved it back to the page" change would shadow the hook's
 *      callback and break the symmetric open/close pair pattern).
 *   6. The page's `cancelTemplateEditor` (the 2-setter HARD close) is
 *      intentionally NOT promoted to the hook — its 2-setter shape
 *      doesn't fit the hook's single-setter close-callback contract.
 *      The test pins that this asymmetry is preserved.
 *
 * The 14 assertions in `open-category-manager-callback.test.ts` already
 * cover the open side of the openCategoryManager/closeCategoryManager
 * pair (the original session 118 source-pattern test). This file is
 * the sister test that pins the close side of all 3 pairs.
 *
 * If a future session removes one of the close callbacks from the
 * hook, re-introduces the page-local form, or re-shapes the SOFT/HARD
 * editor close discriminator, this test fails.
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
const useMissionsPagePath = join(
  REPO_ROOT,
  "src",
  "hooks",
  "useMissionsPage.ts",
);

describe("missions modal close-callbacks promoted to useMissionsPage hook", () => {
  const pageSource = readFileSync(missionsPagePath, "utf-8");
  const hookSource = readFileSync(useMissionsPagePath, "utf-8");

  describe("closeCategoryManager (sibling of openCategoryManager from session 118)", () => {
    it("hook declares closeCategoryManager as a useCallback that calls setShowCategoryManager(false)", () => {
      expect(hookSource).toMatch(
        /const\s+closeCategoryManager\s*=\s*useCallback\(\s*\(\s*\)\s*=>\s*\{?\s*setShowCategoryManager\(false\)\s*;?\s*\}?\s*,\s*\[[^\]]*\]\s*,?\s*\)/s,
      );
    });

    it("hook uses empty deps array for closeCategoryManager (useState setters are stable)", () => {
      const match = hookSource.match(
        /const\s+closeCategoryManager\s*=\s*useCallback\(\s*\(\s*\)\s*=>\s*\{?\s*setShowCategoryManager\(false\)\s*;?\s*\}?\s*,\s*(\[[^\]]*\])\s*,?\s*\)/s,
      );
      expect(match).not.toBeNull();
      expect(match![1].trim()).toBe("[]");
    });

    it("hook exposes closeCategoryManager on the returned vm object", () => {
      expect(hookSource).toMatch(/^\s*closeCategoryManager\s*,?\s*$/m);
    });

    it("page re-exports closeCategoryManager from vm (so JSX can reference it without vm. indirection)", () => {
      expect(pageSource).toMatch(
        /const\s+closeCategoryManager\s*=\s*vm\.closeCategoryManager\s*;/,
      );
    });

    it("page does NOT have a local closeCategoryManager useCallback declaration (moved to hook)", () => {
      // The pre-migration page-local form was
      // `useCallback(() => setShowCategoryManager(false), [setShowCategoryManager])`.
      // The post-migration form is `const closeCategoryManager = vm.closeCategoryManager;`.
      // A regression that re-introduces the page-local form would
      // shadow the hook's callback and break the symmetric open/close
      // pair pattern.
      expect(pageSource).not.toMatch(
        /const\s+closeCategoryManager\s*=\s*useCallback\(\s*\(\s*\)\s*=>\s*setShowCategoryManager\(false\)/,
      );
    });
  });

  describe("closeTemplateManager (sibling of openTemplateManager from session 118)", () => {
    it("hook declares closeTemplateManager as a useCallback that calls setShowTemplateManager(false)", () => {
      expect(hookSource).toMatch(
        /const\s+closeTemplateManager\s*=\s*useCallback\(\s*\(\s*\)\s*=>\s*\{?\s*setShowTemplateManager\(false\)\s*;?\s*\}?\s*,\s*\[[^\]]*\]\s*,?\s*\)/s,
      );
    });

    it("hook uses empty deps array for closeTemplateManager (useState setters are stable)", () => {
      const match = hookSource.match(
        /const\s+closeTemplateManager\s*=\s*useCallback\(\s*\(\s*\)\s*=>\s*\{?\s*setShowTemplateManager\(false\)\s*;?\s*\}?\s*,\s*(\[[^\]]*\])\s*,?\s*\)/s,
      );
      expect(match).not.toBeNull();
      expect(match![1].trim()).toBe("[]");
    });

    it("hook exposes closeTemplateManager on the returned vm object", () => {
      expect(hookSource).toMatch(/^\s*closeTemplateManager\s*,?\s*$/m);
    });

    it("page re-exports closeTemplateManager from vm (so JSX can reference it without vm. indirection)", () => {
      expect(pageSource).toMatch(
        /const\s+closeTemplateManager\s*=\s*vm\.closeTemplateManager\s*;/,
      );
    });

    it("page does NOT have a local closeTemplateManager useCallback declaration (moved to hook)", () => {
      expect(pageSource).not.toMatch(
        /const\s+closeTemplateManager\s*=\s*useCallback\(\s*\(\s*\)\s*=>\s*setShowTemplateManager\(false\)/,
      );
    });
  });

  describe("closeTemplateEditor (SOFT close — sibling of editor's inline open paths)", () => {
    it("hook declares closeTemplateEditor as a useCallback that calls setShowTemplateEditor(false)", () => {
      expect(hookSource).toMatch(
        /const\s+closeTemplateEditor\s*=\s*useCallback\(\s*\(\s*\)\s*=>\s*\{?\s*setShowTemplateEditor\(false\)\s*;?\s*\}?\s*,\s*\[[^\]]*\]\s*,?\s*\)/s,
      );
    });

    it("hook uses empty deps array for closeTemplateEditor (useState setters are stable)", () => {
      const match = hookSource.match(
        /const\s+closeTemplateEditor\s*=\s*useCallback\(\s*\(\s*\)\s*=>\s*\{?\s*setShowTemplateEditor\(false\)\s*;?\s*\}?\s*,\s*(\[[^\]]*\])\s*,?\s*\)/s,
      );
      expect(match).not.toBeNull();
      expect(match![1].trim()).toBe("[]");
    });

    it("hook exposes closeTemplateEditor on the returned vm object", () => {
      expect(hookSource).toMatch(/^\s*closeTemplateEditor\s*,?\s*$/m);
    });

    it("page re-exports closeTemplateEditor from vm (so JSX can reference it without vm. indirection)", () => {
      expect(pageSource).toMatch(
        /const\s+closeTemplateEditor\s*=\s*vm\.closeTemplateEditor\s*;/,
      );
    });

    it("page does NOT have a local closeTemplateEditor useCallback declaration (moved to hook)", () => {
      // The SOFT close was the page-local useCallback. The HARD 2-setter
      // `cancelTemplateEditor` is intentionally still page-local — its
      // 2-setter shape (setShowTemplateEditor + setEditingTemplateId)
      // doesn't fit the hook's single-setter close-callback contract.
      // This assertion pins the SOFT close migration; the HARD close
      // stays in the page.
      expect(pageSource).not.toMatch(
        /const\s+closeTemplateEditor\s*=\s*useCallback\(\s*\(\s*\)\s*=>\s*setShowTemplateEditor\(false\)/,
      );
    });
  });

  describe("cancelTemplateEditor (HARD 2-setter close — intentionally page-local)", () => {
    it("page keeps the 2-setter cancelTemplateEditor (do NOT promote to hook)", () => {
      // The HARD cancel is a 2-setter (`setShowTemplateEditor(false)` +
      // `setEditingTemplateId(null)`) that doesn't fit the hook's
      // single-setter close-callback contract. Migrating it would
      // either re-shape the cancel-then-reopen flow (a behavior
      // change) or expand the hook's API to handle a 2-setter close
      // (out of scope for this session). Pin the page-local form.
      expect(pageSource).toMatch(
        /const\s+cancelTemplateEditor\s*=\s*useCallback\(\s*\(\s*\)\s*=>\s*\{[^}]*setShowTemplateEditor\(false\)[^}]*setEditingTemplateId\(null\)[^}]*\}\s*,\s*\[[^\]]*setShowTemplateEditor[^\]]*setEditingTemplateId[^\]]*\]\s*,?\s*\)/s,
      );
    });

    it("hook does NOT expose cancelTemplateEditor (HARD 2-setter close stays page-local)", () => {
      // Regression guard: a future "migrate everything to the hook"
      // change that exposes `cancelTemplateEditor` on the vm would
      // be a behavior change. The 2-setter shape (setShow + setEditingId)
      // is the page's responsibility.
      expect(hookSource).not.toMatch(/^\s*cancelTemplateEditor\s*,?\s*$/m);
    });
  });

  describe("List 2 surface sanity for the close-callback migration", () => {
    it("the page does NOT have any local single-setter setShowX(false) useCallback declarations (all 3 promoted to hook)", () => {
      // The 3 page-local single-setter close callbacks have all been
      // promoted to the hook. A regression that re-introduces ANY
      // single-setter page-local close callback for these 3 modals
      // would break the symmetric open/close pair pattern.
      expect(pageSource).not.toMatch(
        /useCallback\(\s*\(\s*\)\s*=>\s*setShow(Category|Template)(Manager|Editor|HardwareCreate)\(false\)/,
      );
    });

    it("the page still imports useCallback from react (for cancelTemplateEditor)", () => {
      // The HARD 2-setter cancelTemplateEditor still uses useCallback,
      // so the import must stay. A future "remove unused imports" sweep
      // that drops it would break the cancel callback.
      expect(pageSource).toMatch(
        /import\s*\{\s*useCallback\s*\}\s*from\s*["']react["']/,
      );
    });

    it("every file in scope is readable", () => {
      expect(pageSource.length).toBeGreaterThan(0);
      expect(hookSource.length).toBeGreaterThan(0);
    });
  });
});
