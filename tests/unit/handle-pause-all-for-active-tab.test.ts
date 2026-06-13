/**
 * @jest-environment node
 *
 * Source-pattern test for the session 199 `handlePauseAllForActiveTab`
 * page-local `useCallback` extraction in
 * `src/app/orchestration/cron/page.tsx`.
 *
 * The pre-session source had the tab-conditional inline arrow function
 * at 1 site (the `ActionButtons`'s `onPauseAll` prop):
 *
 *   onPauseAll={() => {
 *     if (activeTab === "agent") {
 *       void agent.handlePauseAll();
 *     } else {
 *       void hardware.handlePauseAll();
 *     }
 *   }}
 *
 * After the refactor, a single `handlePauseAllForActiveTab` page-local
 * `useCallback` sits between `openCreateForActiveTab` and the
 * `useEffect`. The inline arrow function disappears from the JSX, and
 * the `ActionButtons` `onPauseAll` prop receives the named callback.
 *
 * Sister to the existing `openCreateForActiveTab` extraction — same
 * `if (activeTab === "agent") { ... } else { ... }` discriminator shape,
 * same `useCallback` + deps pattern, same Rule of Two for symmetric
 * tab-dispatch callbacks.
 *
 * Why source-pattern instead of rendering the page:
 *   - `CronPage` is a 460-line page that consumes 2 hooks
 *     (useCronJobs, useSystemCronJobs), 2 modal components
 *     (JobFormModal, SystemCronModal), 2 sub-components
 *     (ActionButtons, CronTabContent), and 6 useState slots. Rendering
 *     it requires mocking all of those — overkill for a 1-line
 *     useCallback that just reads activeTab and dispatches to the right
 *     hook's method.
 *   - The byte-level contract is: the `handlePauseAllForActiveTab`
 *     useCallback exists with the right body, and the inline
 *     `() => { if (activeTab === "agent") { void agent.handlePauseAll();`
 *     form is gone from the `onPauseAll` prop.
 *
 * What this test does NOT lock:
 *   - The exact JSDoc text on the helper.
 *   - The exact position of the helper in the file (it could move
 *     without breaking behaviour).
 *   - The 5 other `activeTab === "agent"` discriminator sites that
 *     branch on render output (the color/pauseBusy/hasJobs ternary
 *     trio on lines 391-393, and the tab-conditional JSX root on
 *     line 411) — those are not the same discriminator shape (they
 *     branch on render output, not on action dispatch).
 */

import * as fs from "fs";
import * as path from "path";

const PAGE_PATH = path.resolve(
  __dirname,
  "../../src/app/orchestration/cron/page.tsx",
);

describe("handlePauseAllForActiveTab extraction (session 199)", () => {
  const source = fs.readFileSync(PAGE_PATH, "utf8");

  // Strip block + line comments so the JSDoc-style description of the
  // pre-session form (lines 286-292) doesn't pollute the regex matches.
  // The pre-session source's 1 site appears in actual code, not comments.
  const codeOnly = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((l) => l.replace(/\/\/.*$/, ""))
    .join("\n");

  it("declares handlePauseAllForActiveTab as a useCallback", () => {
    // The post-refactor code has a single
    //   const handlePauseAllForActiveTab = useCallback(() => { ... }, [deps]);
    // declaration between `openCreateForActiveTab` and the
    // `useEffect(() => { if (activeTab === "system") ... }`.
    expect(codeOnly).toMatch(
      /const\s+handlePauseAllForActiveTab\s*=\s*useCallback\(\s*\(\s*\)\s*=>\s*\{/,
    );
  });

  it("branches on activeTab === \"agent\" inside the helper body", () => {
    // The helper body must dispatch to agent.handlePauseAll() for the
    // agent tab and to hardware.handlePauseAll() for the system tab.
    // The discriminator shape is the same as openCreateForActiveTab:
    //   if (activeTab === "agent") { void agent.handlePauseAll(); }
    //   else { void hardware.handlePauseAll(); }
    expect(codeOnly).toMatch(
      /if\s*\(\s*activeTab\s*===\s*["']agent["']\s*\)\s*\{\s*void\s+agent\.handlePauseAll\(\)/,
    );
    expect(codeOnly).toMatch(
      /else\s*\{\s*void\s+hardware\.handlePauseAll\(\)/,
    );
  });

  it("includes activeTab, agent, and hardware in the deps array", () => {
    // The helper closes over activeTab (the discriminator), agent
    // (for handlePauseAll), and hardware (for handlePauseAll). All 3
    // must be in the deps array. Slice the helper body first to avoid
    // matching the `openCreateForActiveTab` deps array (which only
    // includes [activeTab]).
    const helperMatch = codeOnly.match(
      /const\s+handlePauseAllForActiveTab\s*=\s*useCallback\(\s*\(\s*\)\s*=>\s*\{[\s\S]*?\},\s*\[([\s\S]*?)\]\s*\)/,
    );
    expect(helperMatch).not.toBeNull();
    const deps = helperMatch?.[1] ?? "";
    expect(deps).toMatch(/activeTab/);
    expect(deps).toMatch(/agent/);
    expect(deps).toMatch(/hardware/);
  });

  it("uses handlePauseAllForActiveTab in the ActionButtons onPauseAll prop", () => {
    // The post-refactor JSX has
    //   onPauseAll={handlePauseAllForActiveTab}
    // instead of the inline 6-line arrow function. The inline form
    // (containing `if (activeTab === "agent") { void agent.handlePauseAll(); }`)
    // must NOT appear in the `onPauseAll` prop's slice.
    const onPauseAllMatch = codeOnly.match(
      /onPauseAll\s*=\s*\{[\s\S]*?\n\s*\}/,
    );
    expect(onPauseAllMatch).not.toBeNull();
    const slice = onPauseAllMatch?.[0] ?? "";
    expect(slice).toMatch(/handlePauseAllForActiveTab/);
    expect(slice).not.toMatch(/activeTab\s*===\s*["']agent["']/);
  });

  it("does not have an inline tab-conditional handlePauseAll in the JSX", () => {
    // The pre-session source had exactly 1 inline
    // `if (activeTab === "agent") { void agent.handlePauseAll(); }`
    // site (in the onPauseAll prop). After the refactor, the helper
    // is the only place this pattern appears, so the literal pattern
    // `void agent.handlePauseAll();` followed by `else { void hardware.handlePauseAll()`
    // should appear EXACTLY once in the source (only in the helper).
    // The discriminator: count the `void agent.handlePauseAll(); else`
    // patterns, which is unique to the inline form (the helper body
    // uses `if/else` with the same discriminator on adjacent lines,
    // and the inline form's close is `}}` not `)`).
    const matches =
      codeOnly.match(
        /void\s+agent\.handlePauseAll\(\)\s*;\s*\n\s*\}\s*else\s*\{\s*void\s+hardware\.handlePauseAll\(\)/g,
      ) ?? [];
    expect(matches.length).toBe(1);
  });
});
