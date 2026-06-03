/**
 * @jest-environment node
 *
 * Source-pattern test for the session-106 List 1 refactor in
 * src/app/page.tsx (Dashboard).
 *
 * Locks two byte-equivalent consolidations:
 *
 * 1. `activeMissions` filter migrated from the inline
 *    `m.status === "dispatched" || (m.status === "queued" && m.queuedForRun === true)`
 *    predicate to the existing `isMissionActive` helper from
 *    `@/lib/mission-board`. The helper has its own unit tests
 *    (tests/unit/mission-board.test.ts) that lock the predicate
 *    semantics; this test locks the dashboard's *adoption* of the
 *    helper so a future "revert to inline" PR is caught.
 *
 * 2. The optimistic-update site in `handleCronScheduleChange` migrated
 *    from the raw `setDataFields((prev) => ({ ...prev, monitor: f(prev.monitor) }))`
 *    updater form to the `setData({ monitor: f(data.monitor) })` partial-state
 *    helper that the rest of the page already uses. The two are
 *    byte-equivalent because `data.monitor` is in the useCallback deps
 *    so the closure-captured value is always fresh.
 *
 * Why source-pattern instead of rendering the page:
 *   - The Dashboard page is 950+ LOC with 8+ API fetches, 3+ polls,
 *     and 20+ useState calls. Rendering it requires mocking
 *     `useApiData`, `useTwoStepConfirm`, `useInterval`, and the entire
 *     `/api/*` surface — the harness would dwarf the invariants
 *     being tested.
 *   - The "use the helper, not the inline form" shape is a
 *     byte-level contract: the dashboard literally calls
 *     `missions.filter(isMissionActive)` instead of inlining the
 *     predicate.
 *
 * What this test does NOT lock:
 *   - The semantics of `isMissionActive` itself (covered in
 *     `tests/unit/mission-board.test.ts`).
 *   - The runtime behavior of `withCronJobSchedule` (covered by
 *     its consumer sites and the dashboard's own integration tests).
 *   - Any other dashboard fetch/polling logic.
 *
 * If the dashboard is restructured (e.g. split into a hook + view),
 * the file path and shape-string assertions will need to be updated
 * — the test's failure will then force the refactor author to
 * consciously decide whether the new shape preserves the
 * helper-adoption + setData-as-canonical-setter invariants.
 */

import * as fs from "node:fs";
import * as path from "node:path";

const DASHBOARD_PATH = path.resolve(
  __dirname,
  "../../src/app/page.tsx",
);

describe("dashboard List 1 helper adoption (session 106)", () => {
  const source = fs.readFileSync(DASHBOARD_PATH, "utf8");

  describe("activeMissions filter → isMissionActive helper", () => {
    it("imports isMissionActive from @/lib/mission-board", () => {
      // The helper lives at src/lib/mission-board.ts and is exported
      // as a named function. The dashboard must import it directly,
      // not re-derive the predicate inline.
      expect(source).toMatch(
        /import\s*\{\s*isMissionActive\s*\}\s*from\s*["']@\/lib\/mission-board["']/,
      );
    });

    it("activeMissions useMemo uses .filter(isMissionActive) (not the inline 2-line predicate)", () => {
      // The refactored filter is a single-line `.filter(isMissionActive)`
      // callback — the inline `(m) => m.status === "dispatched" || (m.status === "queued" && m.queuedForRun === true)`
      // form must be GONE from the page (otherwise we'd be duplicating
      // the helper's logic).
      expect(source).toMatch(/missions\.filter\(isMissionActive\)/);

      // The 2-line inline predicate (split across lines with `||` and `&&`)
      // must NOT appear anywhere in the file.
      const inlinePredicatePattern =
        /m\.status\s*===\s*["']dispatched["']\s*\|\|\s*\(\s*m\.status\s*===\s*["']queued["']\s*&&\s*m\.queuedForRun\s*===\s*true\s*\)/;
      expect(source).not.toMatch(inlinePredicatePattern);
    });
  });

  describe("handleCronScheduleChange setDataFields → setData consolidation", () => {
    it("does not call setDataFields directly anywhere in handleCronScheduleChange", () => {
      // The page defines `setData = useCallback((partial) => setDataFields(prev => ...))`
      // at line ~179. After the refactor, NO direct `setDataFields((prev) => ...)`
      // call should remain in the body of `handleCronScheduleChange` (or anywhere
      // else in the component body). The only `setDataFields` mentions should be
      // (a) the destructured pair in the useState declaration, and
      // (b) the body of the `setData` helper itself.
      //
      // We lock this with two checks: a regex search for the updater form
      // `setDataFields((prev)` (the inline direct-call pattern), and a count
      // check that exactly 2 `setDataFields` references remain.
      const updaterForm = /setDataFields\(\(prev\)/g;
      const updaterFormMatches = source.match(updaterForm);
      expect(updaterFormMatches).toBeNull();
    });

    it("uses the setData partial setter in the optimistic-update site", () => {
      // The optimistic update must call `setData({ monitor: withCronJobSchedule(data.monitor, ...) })`
      // — the same `setData` helper that the rest of the page uses (line ~253,
      // ~309, ~341-349, ~399). Specifically, the optimistic-update line must
      // reference `data.monitor` (the closure-captured value) and the
      // `withCronJobSchedule` helper.
      expect(source).toMatch(
        /setData\(\s*\{\s*monitor:\s*withCronJobSchedule\(data\.monitor,\s*jobId,\s*scheduleDisplay\)\s*,?\s*\}\s*\)/,
      );
    });

    it("handleCronScheduleChange useCallback deps include data.monitor (keeps the closure fresh)", () => {
      // The `setData({ monitor: withCronJobSchedule(data.monitor, ...) })` form
      // reads `data.monitor` from the closure. For this to be byte-equivalent
      // to the old `setDataFields((prev) => ({ ...prev, monitor: f(prev.monitor) }))`
      // form, `data.monitor` MUST be in the useCallback deps array. Without
      // this dep, the closure would be stale and the optimistic update would
      // operate on an old monitor snapshot.
      //
      // The useCallback for handleCronScheduleChange ends with
      // `}, [data.monitor, showToast, refreshMonitor]);`. We assert
      // `data.monitor` is in the deps array of the `handleCronScheduleChange`
      // callback specifically (not just somewhere in the file).
      const handleCronScheduleChangeDeps = source.match(
        /handleCronScheduleChange\s*=\s*useCallback[\s\S]*?\}\s*,\s*\[([^\]]+)\]\)/,
      );
      expect(handleCronScheduleChangeDeps).not.toBeNull();
      const depsList = handleCronScheduleChangeDeps![1];
      expect(depsList).toMatch(/data\.monitor/);
    });

    it("setDataFields appears exactly twice (useState destructure + setData helper body)", () => {
      // After the refactor, the only direct-references to the raw dispatch
      // setter (the second tuple element from the useState destructure) in
      // the file should be:
      //   1. The `useState<{...}>(...)` destructure at line ~159:
      //      `const [data, rawDispatch] = useState<...>(...)`
      //   2. The body of the `setData` helper at line ~180:
      //      `rawDispatch(prev => ({ ...prev, ...partial }))`
      // Any additional reference indicates a missed migration site.
      //
      // (We assert by name `setDataFields` because that's the destructured
      // identifier; the test only fails if a future PR re-introduces a
      // direct call without re-binding the name.)
      const setDataFieldsMatches = source.match(/setDataFields/g);
      expect(setDataFieldsMatches).not.toBeNull();
      expect(setDataFieldsMatches!.length).toBe(2);
    });
  });
});
