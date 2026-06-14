/** @jest-environment node */
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Post-delete reload behaviour for the category concern.
 *
 * A category delete reassigns its missions to the fallback category, so after
 * the delete three slices go stale: the category catalog, the missions list,
 * and the templates. The original `reloadAllData` useCallback in
 * `useMissionsPage` ran all three in a single `Promise.allSettled([...])`.
 *
 * The `useMissionCategories` extraction split this along the cohesion seam:
 *   - `useMissionsPage` owns `reloadMissionsAndTemplates` — a `Promise.allSettled`
 *     of the missions + templates slices (the slices the category hook does not
 *     own) — and injects it into the category hook as `onMissionsReassigned`.
 *   - `useMissionCategories.handleDeleteCategory` runs `loadCategories()` (own)
 *     and `onMissionsReassigned()` in parallel via `Promise.allSettled`.
 *
 * Net runtime behaviour is unchanged: after a delete all three slices refetch
 * concurrently, and a single failing slice does not abort the others. This test
 * pins the new shape so a regression that re-serialises the reload (or drops a
 * slice) trips here.
 */
const REPO_ROOT = join(__dirname, "..", "..");
const hookSource = readFileSync(
  join(REPO_ROOT, "src", "hooks", "useMissionsPage.ts"),
  "utf-8",
);
const categoriesSource = readFileSync(
  join(REPO_ROOT, "src", "hooks", "useMissionCategories.ts"),
  "utf-8",
);

describe("category delete reload (useMissionsPage + useMissionCategories)", () => {
  it("useMissionsPage declares reloadMissionsAndTemplates as a Promise.allSettled of the 2 owned slices", () => {
    const startIdx = hookSource.indexOf(
      "const reloadMissionsAndTemplates = useCallback(",
    );
    expect(startIdx).toBeGreaterThan(-1);
    const closingIdx = hookSource.indexOf("]);", startIdx);
    expect(closingIdx).toBeGreaterThan(startIdx);
    const decl = hookSource.slice(startIdx, closingIdx + 3);
    expect(decl).toMatch(/Promise\.allSettled\(/);
    expect(decl).toMatch(/fetchMissions\(\)\.then\(setMissions\)/);
    expect(decl).toMatch(/fetchTemplates\(\)\.then\(setTemplates\)/);
    // It does NOT reload categories — that slice belongs to the category hook.
    expect(decl).not.toMatch(/loadCategories\(\)/);
  });

  it("reloadMissionsAndTemplates deps array is exactly [fetchMissions, fetchTemplates]", () => {
    // Anchor on the deps signature directly — the body's inner
    // `Promise.allSettled([...]);` would trap a generic `]);` search.
    const startIdx = hookSource.indexOf(
      "const reloadMissionsAndTemplates = useCallback(",
    );
    expect(startIdx).toBeGreaterThan(-1);
    expect(
      hookSource.indexOf("}, [fetchMissions, fetchTemplates]", startIdx),
    ).toBeGreaterThan(startIdx);
  });

  it("useMissionsPage injects reloadMissionsAndTemplates as the category hook's onMissionsReassigned", () => {
    expect(hookSource).toMatch(
      /onMissionsReassigned:\s*reloadMissionsAndTemplates/,
    );
  });

  it("useMissionCategories.handleDeleteCategory awaits deleteCategory then Promise.allSettles the catalog + reassigned slices", () => {
    const startIdx = categoriesSource.indexOf(
      "const handleDeleteCategory = useCallback(",
    );
    expect(startIdx).toBeGreaterThan(-1);
    const closingIdx = categoriesSource.indexOf("]);", startIdx);
    expect(closingIdx).toBeGreaterThan(startIdx);
    const decl = categoriesSource.slice(startIdx, closingIdx + 3);
    expect(decl).toMatch(/await\s+deleteCategory\(id,\s*reassignToId\)/);
    expect(decl).toMatch(/Promise\.allSettled\(\s*\[\s*loadCategories\(\)/);
    expect(decl).toMatch(/onMissionsReassigned\(\)/);
  });

  it("handleDeleteCategory deps array is exactly [deleteCategory, loadCategories, onMissionsReassigned]", () => {
    // Anchor on the deps signature directly (inner Promise.allSettled trap).
    const startIdx = categoriesSource.indexOf(
      "const handleDeleteCategory = useCallback(",
    );
    expect(startIdx).toBeGreaterThan(-1);
    expect(
      categoriesSource.indexOf(
        "[deleteCategory, loadCategories, onMissionsReassigned]",
        startIdx,
      ),
    ).toBeGreaterThan(startIdx);
  });

  it("the single-slice loadCategories sites (create + update) stay category-only", () => {
    // handleCreateCategory + handleUpdateCategory reload only the catalog —
    // widening them to the 3-slice reload would be a behaviour change.
    const inlineLoadCategories = (
      categoriesSource.match(/^\s*await\s+loadCategories\(\);/gm) ?? []
    ).length;
    expect(inlineLoadCategories).toBe(2);
  });
});
