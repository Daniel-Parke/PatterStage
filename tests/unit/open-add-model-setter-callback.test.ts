/**
 * @jest-environment node
 *
 * Source-pattern test for the session-103 openAddModel refactor +
 * session-196 closeModelEditor + closeFallbackModal refactor in
 * src/app/config/models/page.tsx.
 *
 * Locks the shape of the 3 page-local callbacks (openAddModel,
 * closeModelEditor, closeFallbackModal) so a future "tidy up the
 * 4 setEditing/setEditingFallbackEntry sites" PR can't accidentally:
 *   - re-introduce the inline `() => setEditing(null)` open-create form
 *   - re-introduce the inline `() => setEditing(undefined)` close form
 *   - re-introduce the inline `() => setEditingFallbackEntry(null)`
 *     close-fallback form
 *   - thread a `ModelEditorRecord` argument into the open helper
 *     (the 3rd `setEditing(...)` site is edit-mode-open, not
 *     create-mode-open; has a different shape and is NOT a
 *     duplicate of this helper)
 *   - change the deps array (useState setters are stable)
 *
 * Why source-pattern instead of rendering the page:
 *   - The page is a 230+ line client component that consumes
 *     30+ fields from the useModelsPage hook. Rendering it
 *     requires mocking the entire hook — overkill for
 *     1-setter pure functions.
 *   - The "useCallback with empty deps calling setX(...)" shape
 *     is the byte-level contract.
 *
 * What this test does NOT lock:
 *   - The exact number of `setEditing(null)` call sites (currently
 *     1 — the helper itself). Adding a 3rd "duplicate from
 *     registry" site in the future is fine; the invariant is
 *     "all create-mode open sites go through the helper", not
 *     "exactly 1 site exists".
 *   - The edit-mode-open binding `onEdit={setEditing}` (different
 *     shape, takes a `ModelEditorRecord`).
 *
 * If any helper is restructured (e.g. moved into a shared
 * `useModalOpen` hook), the file path and shape-string assertions
 * will need to be updated — the test's failure will then force the
 * refactor author to consciously decide whether the new shape
 * preserves the single-setter + empty-deps invariant.
 */

import * as fs from "node:fs";
import * as path from "node:path";

const PAGE_PATH = path.resolve(
  __dirname,
  "../../src/app/config/models/page.tsx",
);

describe("openAddModel callback (session 103)", () => {
  const source = fs.readFileSync(PAGE_PATH, "utf8");

  it("declares openAddModel as a useCallback that calls setEditing(null)", () => {
    // The helper body must be `setEditing(null)` — the
    // create-mode-open form (`null` = "no model, create new one",
    // as opposed to `undefined` = "modal closed" or a
    // `ModelEditorRecord` = "edit this model").
    expect(source).toMatch(
      /const\s+openAddModel\s*=\s*useCallback\(\s*\(\s*\)\s*=>\s*setEditing\(\s*null\s*\)\s*,\s*\[\s*\]\s*\)/,
    );
  });

  it("uses empty deps array (useState setters are stable)", () => {
    // The deps array must be `[]` — same reasoning as the
    // other 2 helpers in this session. We use a non-greedy
    // match for the body to avoid `[^)]*` eating the
    // `setEditing(null)` call's closing paren.
    expect(source).toMatch(
      /const\s+openAddModel\s*=\s*useCallback\([\s\S]*?,\s*\[\s*\]\s*\)\s*;/,
    );
  });

  it("replaces the inline () => setEditing(null) open-create site in the helper", () => {
    // After the session-103 + session-196 refactor, the open-create
    // `() => setEditing(null)` form lives ONLY in the helper
    // declaration (1 occurrence). The pre-session-103 inline JSX
    // sites have been migrated to `openAddModel`. The close site
    // uses a DIFFERENT shape (`setEditing(undefined)`, not `null`)
    // and lives in a separate `closeModelEditor` helper (see the
    // last test below).
    const codeOnly = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .map((l) => l.replace(/\/\/.*$/, ""))
      .join("\n");

    // 1 (the helper itself) — the JSX site has been migrated.
    const inlineFormMatches =
      codeOnly.match(/\(\s*\)\s*=>\s*setEditing\(\s*null\s*\)/g) ?? [];
    expect(inlineFormMatches.length).toBe(1);

    // 1 declaration + 2 call sites = 3.
    const helperIdMatches = codeOnly.match(/\bopenAddModel\b/g) ?? [];
    expect(helperIdMatches.length).toBeGreaterThanOrEqual(3);
  });

  it("declares closeModelEditor as a useCallback that calls setEditing(undefined)", () => {
    // The close-modal site (previously inline at line 204) has
    // been migrated to `closeModelEditor` in session 196. The
    // helper body must be `setEditing(undefined)` — a different
    // value from the open-create site (`null`), because
    // `editing === undefined` is the "modal closed" check
    // (`{editing !== undefined && ...}` at line 200) and
    // `editing === null` is the "modal open in create mode"
    // check (the `editing !== null` branch inside ModelEditor).
    // Migrating close to the open helper would re-open the modal.
    expect(source).toMatch(
      /const\s+closeModelEditor\s*=\s*useCallback\(\s*\(\s*\)\s*=>\s*setEditing\(\s*undefined\s*\)\s*,\s*\[\s*\]\s*\)/,
    );
  });

  it("replaces the inline () => setEditing(undefined) close site in JSX (anti-A3 — different shape from open)", () => {
    // The close-modal `() => setEditing(undefined)` form lived
    // inline at line 204 before session 196. After the refactor,
    // the inline form lives ONLY in the helper declaration (1
    // occurrence, the closeModelEditor body). The pre-session-196
    // inline JSX site has been migrated to `closeModelEditor`.
    //
    // The discriminator: this is a literal `null` arg match
    // (NOT a prefix match) per the session 102 S-2 pitfall. The
    // close form has `undefined` (different shape from `null`).
    const codeOnly = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .map((l) => l.replace(/\/\/.*$/, ""))
      .join("\n");

    // 1 (the closeModelEditor helper body). 0 in JSX.
    const inlineCloseFormMatches =
      codeOnly.match(/\(\s*\)\s*=>\s*setEditing\(\s*undefined\s*\)/g) ?? [];
    expect(inlineCloseFormMatches.length).toBe(1);

    // 1 declaration + 1 call site = 2.
    const helperIdMatches = codeOnly.match(/\bcloseModelEditor\b/g) ?? [];
    expect(helperIdMatches.length).toBeGreaterThanOrEqual(2);
  });

  it("declares closeFallbackModal as a useCallback that calls setEditingFallbackEntry(null)", () => {
    // The close-fallback-modal site (previously inline at line
    // 184) has been migrated to `closeFallbackModal` in session
    // 196. The helper body must be `setEditingFallbackEntry(null)`
    // — the canonical "dismiss the modal" form. The setter is
    // exposed from `useModelsPage` as a close-modal shim (it
    // forwards to `setFallbackEdit({ entry: null, url: "",
    // saving: false })`), so the call site is the canonical
    // close form, not a partial-update.
    expect(source).toMatch(
      /const\s+closeFallbackModal\s*=\s*useCallback\(\s*\(\s*\)\s*=>\s*setEditingFallbackEntry\(\s*null\s*\)\s*,\s*\[\s*\]\s*\)/,
    );
  });

  it("replaces the inline () => setEditingFallbackEntry(null) close site in JSX", () => {
    // The close-fallback-modal `() => setEditingFallbackEntry(null)`
    // form lived inline at line 184 before session 196. After
    // the refactor, the inline form lives ONLY in the helper
    // declaration (1 occurrence, the closeFallbackModal body).
    const codeOnly = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .map((l) => l.replace(/\/\/.*$/, ""))
      .join("\n");

    // 1 (the helper body). 0 in JSX.
    const inlineFormMatches =
      codeOnly.match(/\(\s*\)\s*=>\s*setEditingFallbackEntry\(\s*null\s*\)/g) ?? [];
    expect(inlineFormMatches.length).toBe(1);

    // 1 declaration + 1 call site = 2.
    const helperIdMatches = codeOnly.match(/\bcloseFallbackModal\b/g) ?? [];
    expect(helperIdMatches.length).toBeGreaterThanOrEqual(2);
  });

  it("preserves the edit-mode-open binding (onEdit={setEditing})", () => {
    // The ModelsTableSection's onEdit prop is the
    // `setEditing` setter itself (edit mode opens with a
    // `ModelEditorRecord` arg, not `null`). This is a
    // different shape from openAddModel and is left as a
    // direct binding — not a duplicate.
    expect(source).toMatch(/onEdit=\{setEditing\}/);
  });
});
