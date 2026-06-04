/**
 * @jest-environment node
 *
 * Source-pattern test for the session-103 closeSkillEditor refactor in
 * src/app/operations/skills/page.tsx.
 *
 * Locks the shape of the closeSkillEditor callback so a future
 * "tidy up the 3 setEditingSkill(null) sites" PR can't
 * accidentally:
 *   - re-introduce the inline `() => setEditingSkill(null)` form
 *   - split the helper into per-call-site variants
 *   - add a 3rd setter to the body (would break the 1-setter invariant)
 *   - change the deps array (would force unnecessary re-renders)
 *
 * Why source-pattern instead of rendering the page:
 *   - The page is a client component that consumes a SkillsData
 *     shape with 50+ fields, plus the useToast hook, plus 12
 *     useState calls, plus 6 useCallback hooks. Rendering it
 *     requires mocking every dependency — the harness would dwarf
 *     the actual invariant we want to lock.
 *   - The "useCallback with empty deps calling setEditingSkill(null)"
 *     shape is the byte-level contract.
 *
 * What this test does NOT lock:
 *   - The exact number of setEditingSkill(null) call sites (currently 3,
 *     but adding a 4th "reset on form submit" site in the future is
 *     fine — the invariant is "all sites go through the helper", not
 *     "exactly 3 sites exist").
 *   - The other 6 useCallback hooks in the file (loadSkills, toggleSkill,
 *     etc.) — those have their own test coverage or are tested in
 *     component-level suites.
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
  "../../src/app/operations/skills/page.tsx",
);

describe("closeSkillEditor callback (session 103)", () => {
  const source = fs.readFileSync(PAGE_PATH, "utf8");

  it("declares closeSkillEditor as a useCallback that calls setEditingSkill(null)", () => {
    // The helper body must be `setEditingSkill(null)` (with optional
    // semicolon/whitespace) — the only setter the helper should call.
    // Adding additional setters (e.g. setEditContent("")) would change
    // the discriminated-close pattern (the session 100 audit locks
    // 1-setter close vs 4-setter close as deliberate UX choices).
    expect(source).toMatch(
      /const\s+closeSkillEditor\s*=\s*useCallback\(\s*\(\s*\)\s*=>\s*setEditingSkill\(\s*null\s*\)\s*,\s*\[\s*\]\s*\)/,
    );
  });

  it("uses empty deps array (useState setters are stable)", () => {
    // The deps array must be `[]` — adding deps would force the
    // helper to be re-created on every parent re-render, which
    // would invalidate the React.memo / useEffect deps that
    // consume the helper downstream (e.g. if a future refactor
    // threads closeSkillEditor as a useEffect dep).
    // Use a non-greedy body match to avoid `[^)]*` eating the
    // `setEditingSkill(null)` call's closing paren.
    expect(source).toMatch(
      /const\s+closeSkillEditor\s*=\s*useCallback\([\s\S]*?,\s*\[\s*\]\s*\)\s*;/,
    );
  });

  it("replaces all 3 inline () => setEditingSkill(null) sites in the page", () => {
    // The page previously had 3 sites of the inline 1-setter
    // form. After the refactor, all 3 must call closeSkillEditor()
    // and the inline form must be gone (except for the helper
    // declaration itself, which is the single 1-setter site).
    //
    // We strip line/block comments first to avoid matching the
    // helper's JSDoc that mentions `() => setEditingSkill(null)`.
    const codeOnly = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .map((l) => l.replace(/\/\/.*$/, ""))
      .join("\n");

    // The helper declaration itself uses
    // `() => setEditingSkill(null)` (1 occurrence). All OTHER
    // occurrences are in JSX. After the refactor, there should
    // be exactly 1 occurrence: the helper itself.
    const inlineFormMatches =
      codeOnly.match(/\(\s*\)\s*=>\s*setEditingSkill\(\s*null\s*\)/g) ?? [];
    expect(inlineFormMatches.length).toBe(1);

    // The helper-identifier `closeSkillEditor` must appear at
    // least 4 times (1 declaration + 3 call sites: modal onClose,
    // Cancel button, load-failure path).
    const helperIdMatches = codeOnly.match(/\bcloseSkillEditor\b/g) ?? [];
    expect(helperIdMatches.length).toBeGreaterThanOrEqual(4);
  });
});
