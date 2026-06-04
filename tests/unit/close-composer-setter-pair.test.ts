/** @jest-environment node */

/**
 * Source-pattern test for the `closeComposer` setter-pair helper in
 * src/hooks/useMissionsPage.ts (and its page-side consumption in
 * src/app/orchestration/missions/page.tsx).
 *
 * The helper is a 2-setter `useCallback` that resets the create/edit
 * mission composer to a closed state:
 *
 *   setEditingId(null);
 *   setShowCreate(false);
 *
 * Before extraction (sessions 95-96), the same 2-setter pair was
 * duplicated at 3 call sites — the 2 success branches of `handleCreate`
 * (update + promote) and the page's `handleCloseCreate` (Sheet onClose,
 * MissionComposerActions onClose, MissionCreateForm onClose). The
 * helper is a byte-equivalent collapse: same setter sequence, same
 * argument values, same order.
 *
 * This test is intentionally source-pattern based (rather than
 * importing the hook) for two reasons:
 *
 *  1. `closeComposer` is not exported from the module — it's a
 *     hook-internal helper returned from the public `useMissionsPage`
 *     API. Importing the hook to test it would require a full
 *     React render harness, which is overkill for a 2-setter pure
 *     function.
 *  2. The byte-equivalence claim is about the *shape* of the helper
 *     (which setters it calls, in which order, with which values),
 *     not about React's `useCallback` behaviour. Source-pattern
 *     tests lock the shape invariant without coupling to React
 *     internals.
 *
 * The test also locks the call-site invariants:
 *   - The 2 inline 2-setter sites are gone (only `closeComposer()` calls remain)
 *   - The page consumes the helper as `vm.closeComposer`
 *   - The page threads it to 3 onClose sites
 *
 * If a future session removes `closeComposer` or re-introduces the
 * inline 2-setter form, this test fails.
 */
import { readFileSync } from "fs";
import { join } from "path";

const hookPath = join(
  __dirname,
  "..",
  "..",
  "src",
  "hooks",
  "useMissionsPage.ts",
);
const missionsPagePath = join(
  __dirname,
  "..",
  "..",
  "src",
  "app",
  "orchestration",
  "missions",
  "page.tsx",
);

describe("closeComposer setter-pair helper (useMissionsPage)", () => {
  const hookSource = readFileSync(hookPath, "utf-8");
  const pageSource = readFileSync(missionsPagePath, "utf-8");

  it("declares closeComposer as a useCallback that calls both setters in the right order", () => {
    // Lock the helper body — both setters, in order: editingId → showCreate
    expect(hookSource).toMatch(
      /const\s+closeComposer\s*=\s*useCallback\(\s*\(\s*\)\s*=>\s*\{[\s\S]*?setEditingId\(null\)[\s\S]*?setShowCreate\(false\)[\s\S]*?\},\s*\[\s*\]\s*\)/,
    );
  });

  it("uses empty deps array (useState setters are stable)", () => {
    // Extract the closeComposer declaration and assert the deps array is empty.
    const match = hookSource.match(
      /const\s+closeComposer\s*=\s*useCallback\(\s*\(\s*\)\s*=>\s*\{[\s\S]*?\},\s*(\[[^\]]*\])\s*\)/,
    );
    expect(match).not.toBeNull();
    expect(match![1].trim()).toBe("[]");
  });

  it("is returned from the hook's public API (returned in the destructure object)", () => {
    // The helper is consumed by the page as `vm.closeComposer`, so it
    // must be in the hook's return object. Lock the public API shape.
    expect(hookSource).toMatch(/closeComposer\s*,/);
  });

  it("replaces both inline 2-setter sites in handleCreate success branches", () => {
    // Lock the byte-equivalence claim: the 2 success branches of
    // handleCreate that used to have the inline form
    //   setEditingId(null);
    //   setShowCreate(false);
    // now call `closeComposer()` instead. Count the new call sites.
    const closeComposerCallCount = (hookSource.match(/closeComposer\(\)/g) || []).length;
    // Expected: 2 call sites in handleCreate success branches
    expect(closeComposerCallCount).toBe(2);
  });

  it("page consumes the helper as vm.closeComposer (not the inline 2-setter form)", () => {
    // The page must NOT contain the inline 2-setter form. It must
    // bind `closeComposer` from the hook and use it.
    expect(pageSource).not.toMatch(/setShowCreate\(false\);[\s\n]+setEditingId\(null\)/);
    expect(pageSource).toMatch(/vm\.closeComposer/);
  });

  it("page threads the helper to 3 onClose sites (Sheet + footer + form)", () => {
    // Count `onClose={handleCloseCreate}` sites in the page. The
    // session 100 refactor consolidated 3 onClose call sites to
    // share the same callback reference.
    const handleCloseCreateCount = (pageSource.match(/onClose=\{handleCloseCreate\}/g) || []).length;
    expect(handleCloseCreateCount).toBe(3);
  });
});
