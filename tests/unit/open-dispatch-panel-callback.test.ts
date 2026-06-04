/** @jest-environment node */

/**
 * Source-pattern test for the `openDispatchPanel` open-callback sibling in
 * src/app/page.tsx (the Dashboard).
 *
 * Session 116 P-7 promoted inline `() => setShowX(true)` arrows next to
 * a `closeX` callback to a named `openX` callback (the open/close sibling
 * pattern). Session 118 applied that pattern to the missions page's
 * `closeCategoryManager` (commit `7f8e2b7` in the carryover). The
 * dashboard page has a similar pattern: the Mission Dispatch accordion
 * header toggles `setDispatchExpanded(!dispatchExpanded)` (line 604) and
 * the "+N more" pill (line 646) called
 * `() => setDispatchExpanded(true)` inline. The latter was promoted to
 * the named `openDispatchPanel` useCallback sibling.
 *
 * The dashboard does NOT have a separate `closeDispatchPanel` callback
 * because the close direction is always a toggle (read the current value,
 * flip it) — `setDispatchExpanded(!dispatchExpanded)` — so there's no
 * pure `setDispatchExpanded(false)` to extract. The "sibling" here is
 * the `openDispatchPanel` helper alone, named to document intent and to
 * match the open-callback naming convention from session 116.
 *
 * This test is intentionally source-pattern based (rather than rendering
 * the page) for two reasons:
 *
 *  1. The byte-equivalence claim is about the *shape* of the helper
 *     (which setter it calls, with which value), not about React's
 *     `useCallback` behaviour. Source-pattern tests lock the shape
 *     invariant without coupling to React internals.
 *  2. Importing the page would require a full Next.js render harness
 *     (AppPageShell + sidebar providers + all the dashboard data
 *     fetches), which is overkill for a 1-setter pure function.
 *
 * The test locks the call-site invariants:
 *   - The 1 inline `() => setDispatchExpanded(true)` arrow is gone
 *   - The page consumes the helper as `openDispatchPanel`
 *   - The page threads it to the "+N more" button's `onClick` prop
 *   - The helper is `useCallback`-wrapped with `[setDispatchExpanded]`
 *     deps (the setter is a stable `useState` reference, listed
 *     explicitly to satisfy the `react-hooks/exhaustive-deps` rule;
 *     functionally the callback is still constant per render cycle).
 *
 * If a future session removes `openDispatchPanel` or re-introduces the
 * inline `() => setDispatchExpanded(true)` form, this test fails.
 */
import { readFileSync } from "fs";
import { join } from "path";

const REPO_ROOT = join(__dirname, "..", "..");
const dashboardPagePath = join(REPO_ROOT, "src", "app", "page.tsx");

describe("openDispatchPanel open-callback sibling (dashboard page)", () => {
  const pageSource = readFileSync(dashboardPagePath, "utf-8");

  it("declares openDispatchPanel as a useCallback that calls setDispatchExpanded(true)", () => {
    // Lock the helper body — a 1-setter useCallback that opens the
    // dispatch panel. Same byte-equivalent shape as the missions page's
    // `openCategoryManager` (session 118) and the cron page's
    // `openAgentCreate` / `openSystemCreate` (sessions 101, 114). The
    // regex uses the `s` flag (dot-matches-newline) so the multi-line
    // `useCallback(() => setDispatchExpanded(true), [setDispatchExpanded])`
    // body shape is matched. Note the trailing comma between
    // `[setDispatchExpanded]` and the closing `)` (a function-call
    // argument separator, not a trailing comma in an array literal) is
    // matched by the optional `,?\s*` group before the closing `)`.
    expect(pageSource).toMatch(
      /const\s+openDispatchPanel\s*=\s*useCallback\(\s*\(\s*\)\s*=>\s*\{?\s*setDispatchExpanded\(true\)\s*;?\s*\}?\s*,\s*\[[^\]]*\]\s*,?\s*\)/s,
    );
  });

  it("uses stable-setter deps array (satisfies react-hooks/exhaustive-deps)", () => {
    // Extract the openDispatchPanel declaration and assert the deps
    // array contains `setDispatchExpanded` (the stable useState setter
    // is listed explicitly to satisfy the exhaustive-deps rule — the
    // callback is still effectively constant per render cycle). Multi-
    // line body shape handled via the `s` flag. The optional `,?\s*`
    // before the closing `)` handles the trailing comma between
    // `[setDispatchExpanded]` and the useCallback's closing paren.
    const match = pageSource.match(
      /const\s+openDispatchPanel\s*=\s*useCallback\(\s*\(\s*\)\s*=>\s*\{?\s*setDispatchExpanded\(true\)\s*;?\s*\}?\s*,\s*(\[[^\]]*\])\s*,?\s*\)/s,
    );
    expect(match).not.toBeNull();
    expect(match![1].trim()).toBe("[setDispatchExpanded]");
  });

  it("replaces the inline () => setDispatchExpanded(true) arrow on the +N more button", () => {
    // The "+N more" pill (line ~646) used to call
    // `() => setDispatchExpanded(true)` inline. The session 118
    // refactor replaced it with the named `openDispatchPanel`
    // callback. The mission-dispatch header still uses
    // `() => setDispatchExpanded(!dispatchExpanded)` (a toggle that
    // reads the current value, so it can't be a stable useCallback) —
    // the test only pins the un-conditional `setDispatchExpanded(true)`
    // arrow as gone.
    expect(pageSource).not.toMatch(
      /onClick=\{\(\)\s*=>\s*setDispatchExpanded\(true\)\}/,
    );
  });

  it("page consumes the helper as openDispatchPanel (passed to +N more onClick)", () => {
    // The named callback must be threaded to the "+N more" button's
    // `onClick` prop. Lock the call-site shape so a future refactor
    // (e.g. a wrapper closure) doesn't silently regress.
    expect(pageSource).toMatch(/onClick=\{openDispatchPanel\}/);
  });

  it("preserves the toggle form on the dispatch header (close is a toggle)", () => {
    // The Mission Dispatch header's `onClick` is a toggle
    // (`!dispatchExpanded`), which reads the current value and so
    // cannot be a stable useCallback. The session 118 refactor
    // intentionally left this inline because the dashboard has no
    // separate "close" callback for the dispatch panel (the close
    // direction IS the toggle). The open/close sibling pattern only
    // applies when there are 2 distinct setters (one `setX(true)`, one
    // `setX(false)`). When the close direction is a toggle, the
    // single named open callback is the only one that benefits from
    // extraction. This test pins the toggle form as still present so
    // a future refactor doesn't accidentally migrate the header to
    // `openDispatchPanel` (which would break the close direction).
    expect(pageSource).toMatch(
      /onClick=\{\(\)\s*=>\s*setDispatchExpanded\(!dispatchExpanded\)\}/,
    );
  });
});
