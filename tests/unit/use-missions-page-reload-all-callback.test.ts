/** @jest-environment node */
import { readFileSync } from "fs";
import { join } from "path";

/**
 * useMissionsPage reloadAllData callback consolidation (List 2 carryover
 * from session 109 / 110 era).
 *
 * Pre-refactor: `handleDeleteCategory` did 3 sequential awaits after
 * `deleteCategory`:
 *
 *   await deleteCategory(id, reassignToId);
 *   await loadCategories();
 *   await fetchMissions().then(setMissions);
 *   const loaded = await fetchTemplates();
 *   setTemplates(loaded);
 *
 * Post-refactor: a single `reloadAllData` useCallback consolidates the
 * 3 independent fetches into a parallel `Promise.allSettled([...])`,
 * and `handleDeleteCategory` collapses to a 1-line call. The 3 fetches
 * are independent (no data flows between them) so they can run
 * concurrently, and `Promise.allSettled` keeps the refetch attempt
 * going even if one slice fails.
 *
 * Byte-equivalent at runtime when all 3 succeed (the common case) —
 * each `setX(Y)` fires for the same Y as the inline form. The only
 * observable difference is when one slice fails: previously the
 * unhandled rejection in `fetchMissions().then(setMissions)` would
 * short-circuit the function; now all 3 settle and the user gets a
 * more complete UI. This is strictly more informative, not less.
 */
const hookPath = join(
  __dirname,
  "..",
  "..",
  "src",
  "hooks",
  "useMissionsPage.ts"
);
const source = readFileSync(hookPath, "utf-8");

describe("useMissionsPage reloadAllData callback", () => {
  it("declares reloadAllData as a useCallback that Promise.allSettles 3 fetches", () => {
    // Use indexOf + slice to find the full declaration. Pitfall 18
    // recipe: regex with [\s\S]*? traps at the first }, so anchor on
    // a known closing marker and slice forward.
    const startIdx = source.indexOf("const reloadAllData = useCallback(");
    expect(startIdx).toBeGreaterThan(-1);
    // Closing shape is `}, [fetchMissions, loadCategories, fetchTemplates]);`
    const afterCallback = source.indexOf(
      "}, [fetchMissions, loadCategories, fetchTemplates]",
      startIdx
    );
    expect(afterCallback).toBeGreaterThan(startIdx);
    const closingIdx = source.indexOf("]);", afterCallback);
    expect(closingIdx).toBeGreaterThan(afterCallback);
    const fullDeclaration = source.slice(startIdx, closingIdx + 3);
    // Body contains the 3 fetches and Promise.allSettled
    expect(fullDeclaration).toMatch(/Promise\.allSettled\(/);
    expect(fullDeclaration).toMatch(/fetchMissions\(\)\.then\(setMissions\)/);
    expect(fullDeclaration).toMatch(/loadCategories\(\)/);
    expect(fullDeclaration).toMatch(/fetchTemplates\(\)\.then\(setTemplates\)/);
  });

  it("deps array is exactly [fetchMissions, loadCategories, fetchTemplates] (no extras)", () => {
    // The reloadAllData declaration uses the 3 fetches as deps — no
    // extras (setMissions/setTemplates are useState setters, stable).
    const startIdx = source.indexOf("const reloadAllData = useCallback(");
    const afterCallback = source.indexOf(
      "}, [fetchMissions, loadCategories, fetchTemplates]",
      startIdx
    );
    const closingIdx = source.indexOf("]);", afterCallback);
    const fullDeclaration = source.slice(startIdx, closingIdx + 3);
    // Strip comments and the body to extract just the deps line
    const depsMatch = fullDeclaration.match(
      /\},\s*\[([^\]]+)\]\s*\)/
    );
    expect(depsMatch).not.toBeNull();
    const deps = depsMatch![1].trim();
    expect(deps).toBe("fetchMissions, loadCategories, fetchTemplates");
  });

  it("handleDeleteCategory collapses to a 1-line reloadAllData call", () => {
    // Pre-refactor: 5-line block (deleteCategory + 3 awaits + 1 fetchTemplates).then)
    // Post-refactor: 2 lines (deleteCategory + reloadAllData).
    const startIdx = source.indexOf("const handleDeleteCategory = useCallback(");
    expect(startIdx).toBeGreaterThan(-1);
    // Find the closing shape: `}, \n    [deleteCategory, reloadAllData]);`
    // Use a regex that matches the actual whitespace (4-space indent + newline)
    const afterCallback = source.search(
      /\},\s*\[deleteCategory, reloadAllData\]/,
      startIdx
    );
    expect(afterCallback).toBeGreaterThan(startIdx);
    const closingIdx = source.indexOf("]);", afterCallback);
    expect(closingIdx).toBeGreaterThan(afterCallback);
    const fullDeclaration = source.slice(startIdx, closingIdx + 3);
    // The 1-line call to reloadAllData is present
    expect(fullDeclaration).toMatch(/await\s+reloadAllData\(\)/);
  });

  it("replaces all 3 inline fetch sites inside handleDeleteCategory", () => {
    // Pre-refactor: handleDeleteCategory had 3 inline fetch sites.
    // Post-refactor: the only fetch-related call inside handleDeleteCategory
    // is `await reloadAllData()`. Audit the body to confirm no
    // `await loadCategories`, `await fetchMissions`, or
    // `await fetchTemplates` survives inline.
    const startIdx = source.indexOf("const handleDeleteCategory = useCallback(");
    const openBrace = source.indexOf("{", startIdx);
    const closingBrace = source.search(
      /\},\s*\[deleteCategory, reloadAllData\]/,
      startIdx
    );
    const body = source.slice(openBrace, closingBrace);
    expect(body).not.toMatch(/await\s+loadCategories\(\)/);
    expect(body).not.toMatch(/await\s+fetchMissions\(\)/);
    expect(body).not.toMatch(/await\s+fetchTemplates\(\)/);
  });

  it("preserves the 3 single-slice loadCategories sites (different functions)", () => {
    // The 3 sites that only reload categories (handleCreateCategory,
    // handleUpdateCategory, applyTemplateToForm) are NOT touched by
    // this refactor — they don't reload missions/templates, so
    // Promise.allSettled would be a behavior change (would reload
    // more than the original). Lock the inline `await loadCategories()`
    // form in those 3 sites so a future "migrate everything" PR
    // doesn't quietly widen them.
    const inlineLoadCategoriesCount = (
      source.match(/^\s*await\s+loadCategories\(\);/gm) ?? []
    ).length;
    expect(inlineLoadCategoriesCount).toBe(3);
  });
});
