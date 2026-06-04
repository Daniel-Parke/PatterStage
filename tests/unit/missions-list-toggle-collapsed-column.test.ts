/**
 * Tests for the MissionsList `toggleCollapsedColumn` closure (session 104).
 *
 * The MissionsList's `BOARD_COLUMNS.map` block had 2 sites of the inline
 * `setCollapsedColumns((prev) => ({ ...prev, [status]: !prev[status] }))`
 * pattern:
 *   1. The column header "Collapse / Show all" button (line 327, pre-refactor)
 *   2. The "Show all N missions" footer button (line 466, pre-refactor)
 *
 * Both call sites use the same shape (toggle the boolean for the current
 * column). Session 104 extracted the closure to `toggleCollapsedColumn`
 * (a file-local closure capturing the per-iteration `status` value and
 * the `setCollapsedColumns` setter), so the 2 call sites can share the
 * updater + spread.
 *
 * These tests are static-pattern tests — they read the MissionsList
 * source and assert the migration happened. This is the same pattern
 * the session 92 / 88 migrations used (see `tests/unit/push-diff-closure-*.test.ts`
 * and the cron populate-collapse test for canonical examples).
 */
import * as fs from "fs";
import * as path from "path";

const MISSIONS_LIST_PATH = path.join(
  process.cwd(),
  "src/components/missions/MissionsList.tsx",
);

function readMissionsList(): string {
  return fs.readFileSync(MISSIONS_LIST_PATH, "utf-8");
}

describe("MissionsList — toggleCollapsedColumn closure", () => {
  it("declares a `toggleCollapsedColumn` closure inside the BOARD_COLUMNS.map block", () => {
    const src = readMissionsList();
    // The closure is declared right after `isCollapsible` and captures
    // the per-iteration `status` value. It is the byte-equivalent
    // replacement for the 2 inline `setCollapsedColumns((prev) => ...)`
    // call sites that used to live in the column header button + the
    // "Show all N missions" footer button.
    expect(src).toMatch(
      /const\s+toggleCollapsedColumn\s*=\s*\(\)\s*=>\s*setCollapsedColumns\(\(prev\)\s*=>\s*\(\{[\s\S]*?\.\.\.prev,[\s\S]*?\[status\]:\s*!prev\[status\][\s\S]*?\}\)\)/,
    );
  });

  it("calls toggleCollapsedColumn from the column header Collapse/Show-all button", () => {
    const src = readMissionsList();
    // The 1st call site is the column header button. Pre-refactor, it
    // was `onClick={() => setCollapsedColumns((prev) => ({ ...prev,
    // [status]: !prev[status] }))}`. Post-refactor, it's
    // `onClick={toggleCollapsedColumn}`.
    expect(src).toMatch(/onClick=\{toggleCollapsedColumn\}/);
  });

  it("uses toggleCollapsedColumn (not the old [status]: false form) on the Show-all footer button", () => {
    const src = readMissionsList();
    // The 2nd call site is the "Show all N missions" footer button.
    // Pre-refactor, it was the slightly-different `setCollapsedColumns(
    // (prev) => ({ ...prev, [status]: false }))` form (force-expand).
    // Post-refactor, it reuses the same `toggleCollapsedColumn`
    // closure — the button is only rendered when
    // `collapsedColumns[status]` is true, so the toggle is equivalent
    // to the force-expand (`!true === false`).
    expect(src).not.toMatch(/\[status\]:\s*false\s*\}\)/);
  });

  it("uses toggleCollapsedColumn at exactly 2 onClick call sites", () => {
    const src = readMissionsList();
    // 2 call sites (column header button + Show-all footer button) +
    // 1 declaration + 1+ in comments = at least 4 occurrences. The
    // important thing is that there are exactly 2 onClick call sites
    // (the 2 inline call sites that were migrated).
    const onClickMatches = src.match(
      /onClick=\{toggleCollapsedColumn\}/g,
    );
    expect(onClickMatches?.length).toBe(2);
  });
});
