/**
 * @jest-environment node
 *
 * Source-pattern test for the session-103 openAddModel refactor in
 * src/app/config/models/page.tsx.
 *
 * Locks the shape of the openAddModel callback so a future
 * "tidy up the 2 setEditing(null) sites" PR can't accidentally:
 *   - re-introduce the inline `() => setEditing(null)` form
 *   - thread a `ModelEditorRecord` argument into the helper
 *     (the 3rd `setEditing(...)` site is edit-mode-open, not
 *     create-mode-open; the 4th is close, not open — both
 *     have different shapes and are NOT duplicates of this helper)
 *   - change the deps array (useState setters are stable)
 *
 * Why source-pattern instead of rendering the page:
 *   - The page is a 195-line client component that consumes
 *     30+ fields from the useModelsPage hook. Rendering it
 *     requires mocking the entire hook — overkill for a
 *     1-setter pure function.
 *   - The "useCallback with empty deps calling setEditing(null)"
 *     shape is the byte-level contract.
 *
 * What this test does NOT lock:
 *   - The exact number of setEditing(null) call sites (currently 2,
 *     but adding a 3rd "duplicate from registry" site in the future
 *     is fine — the invariant is "all create-mode open sites go
 *     through the helper", not "exactly 2 sites exist").
 *   - The 4th `setEditing(...)` site at line 186
 *     (`onClose={() => setEditing(undefined)}`) — that's the
 *     close-modal site (different shape: `undefined` not `null`),
 *     and is documented in the page's JSDoc as intentionally
 *     not migrated.
 *
 * If the helper is restructured (e.g. moved into a shared
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

  it("replaces both inline () => setEditing(null) open-create sites in JSX", () => {
    // The page previously had 2 sites of the inline
    // `() => setEditing(null)` form in JSX (page header
    // Add Model button + ModelsTableSection's onAddModel
    // prop). After the refactor, both sites must use
    // openAddModel, and the inline form must NOT appear
    // in JSX (it now lives only in the helper declaration).
    //
    // Note: the close-modal site uses `() => setEditing(undefined)`
    // (a different shape), but our `setEditing(null)` regex
    // is a literal match on the `null` arg, not a prefix
    // match — so the close site is not counted.
    const codeOnly = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .map((l) => l.replace(/\/\/.*$/, ""))
      .join("\n");

    // The helper declaration itself uses
    // `() => setEditing(null)` (1 occurrence, in the
    // `useCallback` body). All OTHER occurrences are in
    // JSX (onClick / onAddModel props). After the refactor,
    // there should be exactly 1 occurrence: the helper
    // itself. The 2 pre-refactor JSX sites have been
    // migrated to `openAddModel`.
    const inlineFormMatches =
      codeOnly.match(/\(\s*\)\s*=>\s*setEditing\(\s*null\s*\)/g) ?? [];
    expect(inlineFormMatches.length).toBe(1);

    // The helper-identifier `openAddModel` must appear at
    // least 3 times (1 declaration on line 88 + 2 call sites
    // on lines 115 and 143). Use a non-paren-bound match to
    // catch the declaration too (the declaration is
    // `const openAddModel = useCallback(...)`, no `(` after
    // the identifier).
    const helperIdMatches = codeOnly.match(/\bopenAddModel\b/g) ?? [];
    expect(helperIdMatches.length).toBeGreaterThanOrEqual(3);
  });

  it("preserves the close-modal site as a separate inline () => setEditing(undefined)", () => {
    // The close-modal site uses `setEditing(undefined)` (not
    // `null`) — a different shape from the open-create site.
    // Migrating it to openAddModel would set `editing` to
    // `null` on close, which would re-open the modal in
    // create mode (not close it). The test locks the
    // `setEditing(undefined)` close form so a future
    // "consolidate all setEditing calls" PR is forced to
    // consciously justify the change.
    expect(source).toMatch(
      /onClose\s*=\s*\{\s*\(\s*\)\s*=>\s*setEditing\(\s*undefined\s*\)\s*\}/,
    );
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
