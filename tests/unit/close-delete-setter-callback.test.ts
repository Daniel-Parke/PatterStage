/**
 * @jest-environment node
 *
 * Source-pattern test for the session-103 closeDelete refactor in
 * src/app/operations/agents/page.tsx (updated session 183).
 *
 * Locks the shape of the closeDelete callback so a future
 * "tidy up the inline setDeleteTarget(null) sites" PR
 * can't accidentally:
 *   - re-introduce the inline `() => setDeleteTarget(null)` form
 *   - change the deps array (useState setters are stable).
 *
 * Why source-pattern instead of rendering the page:
 *   - The page is a 643-line client component with 16 useState
 *     calls, 7 useCallback hooks, and 5 runSyncAction call sites.
 *     A render harness would dwarf the invariant.
 *   - The "useCallback with empty deps calling setDeleteTarget(null)"
 *     shape is the byte-level contract.
 *
 * Session 183 update: the 3rd `setDeleteTarget(null)` site in
 * handleDelete's success path (previously documented as
 * "intentionally not migrated" because of a confused rationale
 * about "threading a target into a setter-pair callback") was
 * migrated to `closeDelete()`. The pre-session-183 invariant
 * was "0 closeDelete() + 1 bare setDeleteTarget(null) in
 * handleDelete success path". The post-session-183 invariant
 * is "3 closeDelete() call sites + 0 bare setDeleteTarget(null)
 * in code (the helper definition itself contains the call as
 * its body)". The 2-setter conditional block
 * (`if (selectedProfileId === target) { setSelectedProfileId(null);
 * closeEditor(); }`) is unchanged.
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

  it("replaces all 3 inline setDeleteTarget(null) sites with closeDelete()", () => {
    // The page previously had 3 setDeleteTarget(null) sites:
    //   1. Modal `onClose` (X-button / overlay click)
    //   2. Modal Cancel button (footer)
    //   3. handleDelete success path (3-setter success block)
    //
    // All 3 are now routed through closeDelete() (session 183
    // migrated the 3rd site). The post-migration invariant:
    //   - 0 bare `setDeleteTarget(null);` statements in code
    //     (the helper definition itself uses the no-semicolon
    //     form `() => setDeleteTarget(null)`, not the
    //     bare-statement form)
    //   - 4+ occurrences of the `closeDelete` identifier:
    //     1 declaration + 3 call sites (modal onClose +
    //     Cancel button + handleDelete success path).
    const codeOnly = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .map((l) => l.replace(/\/\/.*$/, ""))
      .join("\n");

    // The handleDelete success path now uses closeDelete() —
    // not a bare setDeleteTarget(null) statement. We look for
    // the bare-statement form (with trailing semicolon) to
    // detect regressions to the pre-session-183 shape.
    const bareStatementMatches =
      codeOnly.match(/\bsetDeleteTarget\(\s*null\s*\)\s*;/g) ?? [];
    // 0 occurrences — all 3 sites route through closeDelete().
    expect(bareStatementMatches.length).toBe(0);

    // The helper-identifier `closeDelete` must appear at
    // least 4 times (1 declaration + 3 call sites: modal
    // onClose + Cancel button + handleDelete success path).
    const helperIdMatches = codeOnly.match(/\bcloseDelete\b/g) ?? [];
    expect(helperIdMatches.length).toBeGreaterThanOrEqual(4);
  });

  it("preserves the discriminated success block in handleDelete (anti-A3)", () => {
    // The handleDelete success path has a 3-call block:
    //   closeDelete();                            // (1) dismiss the modal
    //   if (selectedProfileId === target) {       //     discriminated
    //     setSelectedProfileId(null);             // (2) clear selection
    //     closeEditor();                          // (3) dismiss the editor
    //   }
    // This is a discriminated 3-call success path — the 2nd +
    // 3rd calls live behind a target-conditional. The
    // `closeEditor()` reference (added in session 112) is the
    // extracted 1-setter helper for the editor's "close" intent;
    // the surrounding 2 calls stay inline because threading
    // them through a single helper would break the
    // target-conditional + 2-call inner block.
    // The test locks this shape so a future "migrate to a single
    // close handleDelete helper" PR is forced to consciously
    // justify the change.
    //
    // Session 112 update: the literal `setEditor(null);` in the
    // success path was replaced with `closeEditor();` (matching
    // the new 1-setter helper extracted in this session). The
    // invariant is unchanged — the success block is still a
    // 3-call discriminated block — only the inner setter's
    // spelling changed.
    //
    // Session 183 update: the literal `setDeleteTarget(null);`
    // (call #1 in the success block) was replaced with
    // `closeDelete();`. The 3-call shape is preserved; only
    // the spelling of the first call changed. The
    // `closeDelete()` call replaces the inline
    // `setDeleteTarget(null)`.
    expect(source).toMatch(
      /onSuccess:\s*async\s*\(\s*\)\s*=>\s*\{[\s\S]*?closeDelete\s*\(\s*\)[\s\S]*?if\s*\(\s*selectedProfileId\s*===\s*target\s*\)\s*\{[\s\S]*?setSelectedProfileId\(\s*null\s*\)[\s\S]*?closeEditor\s*\(\s*\)/,
    );
  });
});
