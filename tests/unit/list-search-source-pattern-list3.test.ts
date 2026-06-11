/** @jest-environment node */

// Source-pattern test for the `filterByCaseInsensitiveSubstring` helper
// in `src/lib/list-search.ts`. Pins the session-161 List 3 migration:
// the 2 List 3 (Models, Agents, Skills, Tools, Personalities) call
// sites that used to inline the case-insensitive `.includes()` pattern
// now go through the helper. A future regression that re-introduces
// the inline pattern fails this test.
//
// Why this test exists (per the umbrella skill's "sister test +
// cross-list generalised scan" pattern from session 159): the
// helper's own test file (list-search.test.ts) verifies the helper
// works, but doesn't verify the call sites USE it. This file is the
// second layer — it scans the source for the inline pattern and
// asserts 0 matches in the picked list's pages.

import { readFileSync } from "fs";
import { join } from "path";

/**
 * The List 3 surface (per the mission brief's "Models, Agents, Skills,
 * Tools, Personalities" list). Sourced by listing the operations/
 * directory + the config/models hub. Keep this in sync if the
 * mission's "List 3" definition ever expands.
 */
const LIST_3_PAGES = [
  "src/app/operations/agents/page.tsx",
  "src/app/operations/personalities/page.tsx",
  "src/app/operations/skills/page.tsx",
  "src/app/operations/skills/[...path]/page.tsx",
  "src/app/operations/tools/page.tsx",
  "src/app/config/models/page.tsx",
] as const;

/**
 * The inline pattern the helper replaces: `.toLowerCase().includes(`.
 * Note: this is a *substring* match — it intentionally includes any
 * code that calls .toLowerCase().includes, including legitimate
 * single-character .toLowerCase() calls (which the test will flag
 * as false positives if any List 3 page uses a single .toLowerCase()
 * .includes() call outside the migrated sites).
 *
 * As of session 161, the 2 List 3 inline sites are migrated. Any
 * remaining `.toLowerCase().includes(` in these files is a regression
 * to investigate.
 */
const INLINE_PATTERN = ".toLowerCase().includes(";

describe("source-pattern: List 3 (Models, Agents, Skills, Tools, Personalities) — no inline case-insensitive substring filter", () => {
  for (const page of LIST_3_PAGES) {
    it(`${page} uses the helper and has 0 inline '${INLINE_PATTERN}' sites`, () => {
      const fullPath = join(process.cwd(), page);
      const source = readFileSync(fullPath, "utf8");
      const matches = source.split(INLINE_PATTERN).length - 1;
      expect(matches).toBe(0);
    });
  }

  it("the 2 migrated List 3 sites actually import the helper", () => {
    // The skills and personalities pages are the 2 List 3 sites
    // migrated to filterByCaseInsensitiveSubstring in session 161.
    // This test pins the contract: those files must import the helper
    // (so a future refactor that swaps the helper for something else
    // gets caught here too).
    const skills = readFileSync(
      join(process.cwd(), "src/app/operations/skills/page.tsx"),
      "utf8",
    );
    const personalities = readFileSync(
      join(process.cwd(), "src/app/operations/personalities/page.tsx"),
      "utf8",
    );
    expect(skills).toContain("filterByCaseInsensitiveSubstring");
    expect(personalities).toContain("filterByCaseInsensitiveSubstring");
  });
});
