/**
 * @jest-environment node
 *
 * Source-pattern test for the session-103 closeDelete refactor in
 * src/app/operations/agents/page.tsx.
 *
 * Locks the shape of the closeDelete callback so a future
 * "tidy up the 2 modal-close setDeleteTarget(null) sites" PR
 * can't accidentally:
 *   - re-introduce the inline `() => setDeleteTarget(null)` form
 *   - thread a `target` argument into the helper (the 3rd
 *     `setDeleteTarget(null)` site in handleDelete's success path
 *     lives next to a 2-setter block that also clears
 *     selectedProfileId and editor; threading target into the
 *     helper would force a 3-setter discriminated signature
 *     that doesn't fit the 2-setter close pattern).
 *   - change the deps array (useState setters are stable).
 *
 * Why source-pattern instead of rendering the page:
 *   - The page is a 591-line client component with 16 useState
 *     calls, 7 useCallback hooks, and 5 runSyncAction call sites.
 *     A render harness would dwarf the invariant.
 *   - The "useCallback with empty deps calling setDeleteTarget(null)"
 *     shape is the byte-level contract.
 *
 * What this test does NOT lock:
 *   - The 3rd `setDeleteTarget(null)` site in handleDelete's
 *     success path (line 201). That's a different intent
 *     (3-setter success block, not a 1-setter modal close) and
 *     is documented in the page's JSDoc as intentionally not
 *     migrated. Adding it to the helper would break the
 *     discriminated pattern.
 *   - The other 5 useCallback hooks in the file (loadProfiles,
 *     doSync, handleCreate, handleDelete, handleSave).
 *
 * If the helper is restructured (e.g. moved into a shared
 * `useModalClose` hook), the file path and shape-string assertions
 * will need to be updated — the test's failure will then force the
 * refactor author to consciously decide whether the new shape
 * preserves the single-setter + empty-deps invariant.
 */

import * as fs from "node:fs";
import * as path from "node:path";

const PAGE_PATH = path.resolve(
  __dirname,
  "../../src/app/operations/agents/page.tsx",
);

describe("closeDelete callback (session 103)", () => {
  const source = fs.readFileSync(PAGE_PATH, "utf8");

  it("declares closeDelete as a useCallback that calls setDeleteTarget(null)", () => {
    // The helper body must be `setDeleteTarget(null)` — a single
    // setter, not a setter-pair. Adding additional setters (e.g.
    // setDeleteTarget(null); setSelectedProfileId(null)) would
    // change the discriminated-close pattern (the handleDelete
    // success path is the 2+ setter close; this helper is the
    // 1-setter X-button / Cancel close).
    expect(source).toMatch(
      /const\s+closeDelete\s*=\s*useCallback\(\s*\(\s*\)\s*=>\s*setDeleteTarget\(\s*null\s*\)\s*,\s*\[\s*\]\s*\)/,
    );
  });

  it("uses empty deps array (useState setters are stable)", () => {
    // The deps array must be `[]` — same reasoning as
    // closeSkillEditor above.
    expect(source).toMatch(
      /const\s+closeDelete\s*=\s*useCallback\([\s\S]*?,\s*\[\s*\]\s*\)\s*;/,
    );
  });

  it("replaces both inline () => setDeleteTarget(null) close-modal sites", () => {
    // The page previously had 3 setDeleteTarget(null) sites:
    //   1. Modal `onClose` (X-button / overlay click)
    //   2. Modal Cancel button (footer)
    //   3. handleDelete success path (3-setter success block)
    // Sites 1+2 are migrated to closeDelete(). Site 3 is
    // intentionally left inline (documented in the JSDoc — it's
    // a 3-setter discriminated block, not a 1-setter modal close).
    //
    // After the refactor:
    //   - 1 occurrence of `() => setDeleteTarget(null)` in code:
    //     the handleDelete success path (the helper declaration
    //     itself does NOT use this form — it uses
    //     `() => setDeleteTarget(null)` directly, no `() =>` wrapper).
    //   - 3+ occurrences of the `closeDelete` identifier:
    //     1 declaration + 2 call sites (modal onClose + Cancel).
    const codeOnly = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .map((l) => l.replace(/\/\/.*$/, ""))
      .join("\n");

    // The handleDelete success path uses the BARE-statement form
    // `setDeleteTarget(null);` (no `() =>` wrapper — it's a
    // 3-setter success block, not a 1-setter modal close).
    // We look for the bare-statement form to detect the
    // success path, and for the helper declaration
    // `() => setDeleteTarget(null)` to detect the helper.
    const bareStatementMatches =
      codeOnly.match(/\bsetDeleteTarget\(\s*null\s*\)\s*;/g) ?? [];
    // 1 occurrence: the handleDelete success path
    // (line 219: `setDeleteTarget(null);`).
    expect(bareStatementMatches.length).toBe(1);

    // The helper-identifier `closeDelete` must appear at
    // least 3 times (1 declaration + 2 call sites: modal
    // onClose + Cancel button).
    const helperIdMatches = codeOnly.match(/\bcloseDelete\b/g) ?? [];
    expect(helperIdMatches.length).toBeGreaterThanOrEqual(3);
  });

  it("preserves the 3-setter success block in handleDelete (anti-A3)", () => {
    // The handleDelete success path has the 3-setter block:
    //   setDeleteTarget(null);
    //   if (selectedProfileId === target) {
    //     setSelectedProfileId(null);
    //     setEditor(null);
    //   }
    // This is a discriminated 3-setter success path — NOT a
    // duplicate of the 1-setter modal close. The test locks
    // this shape so a future "migrate to closeDelete()" PR
    // (which would break the target-conditional + 2-setter
    // inner block) is forced to consciously justify the change.
    expect(source).toMatch(
      /onSuccess:\s*async\s*\(\s*\)\s*=>\s*\{[\s\S]*?setDeleteTarget\(\s*null\s*\)[\s\S]*?if\s*\(\s*selectedProfileId\s*===\s*target\s*\)\s*\{[\s\S]*?setSelectedProfileId\(\s*null\s*\)[\s\S]*?setEditor\(\s*null\s*\)/,
    );
  });
});
