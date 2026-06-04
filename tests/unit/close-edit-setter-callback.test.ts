/**
 * @jest-environment node
 *
 * Source-pattern test for the closeEdit refactor in
 * src/app/operations/personalities/page.tsx.
 *
 * Locks the shape of the closeEdit callback so a future
 * "tidy up the 2 modal-close setEditTarget(undefined) sites" PR
 * can't accidentally:
 *   - re-introduce the inline `() => setEditTarget(undefined)` form
 *   - change the deps array (useState setters are stable)
 *   - drop the helper and inline both sites again
 *
 * Why source-pattern instead of rendering the page:
 *   - The page is a 413-line client component with a 3-state
 *     `editTarget` (undefined = closed, null = create, Personality
 *     = edit), 3 useState calls, 1 useCallback hook (loadPersonalities),
 *     and 1 useMemo. A render harness would dwarf the invariant.
 *   - The "useCallback with empty deps calling setEditTarget(undefined)"
 *     shape is the byte-level contract.
 *
 * What this test does NOT lock:
 *   - The OPEN `setEditTarget(...)` sites: the New button sets
 *     `setEditTarget(null)` and the card onEdit sets
 *     `setEditTarget(personality)`. These are NOT duplicates of
 *     close — they pass different values for different intents.
 *   - The 3-setter success path in handleSaved (setEditTarget via
 *     closeEdit + loadPersonalities + showToast). The 3-setter block
 *     is preserved; only the close half is delegated to the helper.
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
  "../../src/app/operations/personalities/page.tsx",
);

describe("closeEdit callback (personalities page)", () => {
  const source = fs.readFileSync(PAGE_PATH, "utf8");

  it("declares closeEdit as a useCallback that calls setEditTarget(undefined)", () => {
    // The helper body must be `setEditTarget(undefined)` — a
    // single setter, not a setter-pair. Adding additional setters
    // (e.g. setEditTarget(undefined); setEditName("")) would
    // change the discriminated-close pattern (the handleSaved
    // success path is the 2+ setter close; this helper is the
    // 1-setter X-button / Cancel close).
    expect(source).toMatch(
      /const\s+closeEdit\s*=\s*useCallback\(\s*\(\s*\)\s*=>\s*setEditTarget\(\s*undefined\s*\)\s*,\s*\[\s*\]\s*\)/,
    );
  });

  it("uses empty deps array (useState setters are stable)", () => {
    // The deps array must be `[]` — same reasoning as
    // closeDelete / closeSkillEditor in the operations/agents
    // and operations/skills pages.
    expect(source).toMatch(
      /const\s+closeEdit\s*=\s*useCallback\([\s\S]*?,\s*\[\s*\]\s*\)\s*;/,
    );
  });

  it("replaces both inline () => setEditTarget(undefined) close-modal sites", () => {
    // The page previously had 2 setEditTarget(undefined) sites
    // for CLOSE:
    //   1. Modal `onClose` (X-button / overlay click)
    //   2. handleSaved's 3-setter success block (first line)
    // Both are migrated to closeEdit() / closeEdit.
    //
    // After the refactor:
    //   - 0 occurrences of the inline arrow-form
    //     `() => setEditTarget(undefined)` outside the helper
    //     declaration.
    //   - 3+ occurrences of the `closeEdit` identifier:
    //     1 declaration + 2 call sites (modal onClose +
    //     handleSaved's success path).
    const codeOnly = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .map((l) => l.replace(/\/\/.*$/, ""))
      .join("\n");

    // The inline arrow-form should be gone outside the helper.
    // We allow exactly 1 occurrence (the helper declaration
    // itself: `() => setEditTarget(undefined)`).
    const arrowFormMatches =
      codeOnly.match(/\(\s*\)\s*=>\s*setEditTarget\(\s*undefined\s*\)/g) ?? [];
    expect(arrowFormMatches.length).toBe(1);

    // The helper-identifier `closeEdit` must appear at
    // least 3 times (1 declaration + 2 call sites: modal
    // onClose + handleSaved).
    const helperIdMatches = codeOnly.match(/\bcloseEdit\b/g) ?? [];
    expect(helperIdMatches.length).toBeGreaterThanOrEqual(3);
  });

  it("preserves the 2 OPEN setEditTarget sites (anti-discriminator-collapse)", () => {
    // The OPEN sites that pass different values MUST stay inline
    // (they're not duplicates of close):
    //   - The "New" button: `setEditTarget(null)` (create mode)
    //   - The card's onEdit: `setEditTarget(personality)` (edit mode)
    // Migrating either to a closeEdit-style helper would be
    // wrong — they have different intents and different payload
    // types. The test locks both inline forms so a future
    // "migrate everything" PR is forced to consciously justify.
    expect(source).toMatch(
      /onClick=\{?\s*\(\s*\)\s*=>\s*setEditTarget\(\s*null\s*\)\s*\}?/,
    );
    expect(source).toMatch(
      /onEdit=\{?\s*\(personality\)\s*=>\s*setEditTarget\(\s*personality\s*\)\s*\}?/,
    );
  });

  it("preserves the 3-setter success block in handleSaved (anti-A3-collapse)", () => {
    // The handleSaved success path has the 3-setter block:
    //   closeEdit();
    //   loadPersonalities();
    //   showToast("Personality saved!", "success");
    // This is a discriminated 3-setter success path — NOT a
    // duplicate of the 1-setter modal close. The test locks
    // this shape so a future "consolidate to closeEdit()"
    // refactor that would strip the 3-setter block is forced
    // to consciously justify the change.
    expect(source).toMatch(
      /const\s+handleSaved\s*=\s*\(\s*\)\s*=>\s*\{[\s\S]*?closeEdit\(\s*\)[\s\S]*?loadPersonalities\(\s*\)[\s\S]*?showToast\(\s*"Personality saved!"/,
    );
  });
});
