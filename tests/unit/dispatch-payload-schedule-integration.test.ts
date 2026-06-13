/**
 * @jest-environment node
 *
 * Source-pattern test for the session 198 `dispatchPayload` schedule
 * integration refactor in src/hooks/useMissionsPage.ts.
 *
 * The pre-session source had the same override expression
 *   schedule: scheduleForDispatch(newDispatch, newSchedule)
 * repeated at 3 call sites of `dispatchPayload`:
 *   - the update branch (line 750)
 *   - the promote branch (line 777)
 *   - the dispatch-new branch (line 837)
 *
 * After the refactor, the override is gone (call sites collapse to
 * `dispatchPayload()` or `dispatchPayload({ dispatchMode: ... })`),
 * and the schedule is derived INSIDE `dispatchPayload` itself via the
 * canonical `scheduleForDispatch` helper from `@/lib/dispatch-mode`.
 *
 * Why source-pattern instead of rendering the hook:
 *   - `useMissionsPage` is a 1400-line hook that consumes 7 other
 *     hooks (useMissionsApi, useToast, useState slots for ~20
 *     fields, etc.). Rendering it requires mocking all of those —
 *     overkill for a `useCallback` that just reads form state and
 *     calls `scheduleForDispatch(newDispatch, newSchedule)`.
 *   - The byte-level contract is: `dispatchPayload` body contains the
 *     `schedule: scheduleForDispatch(newDispatch, newSchedule)`
 *     expression, the 3 call sites contain ZERO `schedule:` keys in
 *     their override objects, and the `scheduleForDispatch` import
 *     is still present (the helper is the canonical source of truth).
 *
 * What this test does NOT lock:
 *   - The exact `dispatchPayload` body shape beyond the schedule line.
 *   - The JSDoc / dep-array ordering. The test only asserts the
 *     schedule line is present and the 3 call-site overrides no
 *     longer carry the `schedule:` key.
 *   - The `dispatchMode: newDispatch` / `dispatchMode: "now"` keys at
 *     the call sites (those are unrelated to the refactor and may
 *     evolve independently).
 */

import * as fs from "fs";
import * as path from "path";

const HOOK_PATH = path.resolve(
  __dirname,
  "../../src/hooks/useMissionsPage.ts",
);

describe("dispatchPayload schedule integration (session 198)", () => {
  const source = fs.readFileSync(HOOK_PATH, "utf8");

  // Strip block + line comments so the JSDoc-style description of the
  // pre-session form (lines 285-300) doesn't pollute the regex matches.
  // The pre-session source's 3 sites appear in actual code, not comments.
  const codeOnly = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((l) => l.replace(/\/\/.*$/, ""))
    .join("\n");

  it("imports scheduleForDispatch from @/lib/dispatch-mode", () => {
    // The canonical helper must still be imported — the refactor moves
    // the call from 3 call sites into `dispatchPayload`, but the helper
    // itself remains the source of truth.
    expect(source).toMatch(
      /import\s*\{\s*scheduleForDispatch\s*\}\s*from\s*["']@\/lib\/dispatch-mode["']/,
    );
  });

  it("embeds scheduleForDispatch(newDispatch, newSchedule) in the dispatchPayload body", () => {
    // The post-refactor body has a single `schedule: scheduleForDispatch(newDispatch, newSchedule)`
    // line inside the `dispatchPayload` useCallback. This is the canonical
    // derivation; the 3 call-site overrides were exactly this expression.
    expect(source).toMatch(
      /schedule:\s*scheduleForDispatch\(\s*newDispatch\s*,\s*newSchedule\s*\)\s*,/,
    );
  });

  it("uses scheduleForDispatch(newDispatch, newSchedule) exactly once in the dispatchPayload body", () => {
    // The refactor moves the call from 3 sites to 1 site (inside
    // dispatchPayload). The total count in the file should drop from 4
    // (1 in dispatchPayload + 3 in overrides) to 1 (only inside
    // dispatchPayload). Strip comments first to exclude the JSDoc
    // description text.
    const matches =
      codeOnly.match(
        /scheduleForDispatch\(\s*newDispatch\s*,\s*newSchedule\s*\)/g,
      ) ?? [];
    expect(matches.length).toBe(1);
  });

  it("does not pass schedule: scheduleForDispatch at any of the 3 call sites", () => {
    // The 3 call sites used to look like:
    //   ...dispatchPayload({ schedule: scheduleForDispatch(newDispatch, newSchedule) })
    //   ...dispatchPayload({ dispatchMode: newDispatch, schedule: scheduleForDispatch(...) })
    // After the refactor, no call site passes a `schedule:` key. The
    // discriminator is the literal `schedule: scheduleForDispatch(newDispatch,`
    // form followed by a `})` or `}),` pattern (a call-site override
    // object close), which must appear ZERO times in the file. The
    // dispatchPayload body line ends with `,` (not `})`), so this
    // discriminator excludes the body. The previous test "uses
    // scheduleForDispatch exactly once" already proves the body keeps
    // the call — this test proves the call sites don't.
    const callSiteMatches =
      codeOnly.match(
        /schedule:\s*scheduleForDispatch\(\s*newDispatch\s*,\s*newSchedule\s*\)\s*,?\s*\}/g,
      ) ?? [];
    expect(callSiteMatches.length).toBe(0);
  });

  it("includes newDispatch and newSchedule in the dispatchPayload deps array", () => {
    // The helper now closes over newDispatch + newSchedule, so both must
    // be in the deps array. The deps array sits between the body
    // and the closing `);` of the useCallback. Find the dispatchPayload
    // function body first, then assert the deps array contains the 2
    // new keys.
    const dispatchPayloadMatch = source.match(
      /const\s+dispatchPayload\s*=\s*useCallback\([\s\S]*?\),\s*\[([\s\S]*?)\]\s*\);/,
    );
    expect(dispatchPayloadMatch).not.toBeNull();
    const deps = dispatchPayloadMatch?.[1] ?? "";
    expect(deps).toMatch(/newDispatch/);
    expect(deps).toMatch(/newSchedule/);
  });

  it("collapses the update-branch call site to dispatchPayload() with no override keys", () => {
    // The update branch (around line 750) had:
    //   ...dispatchPayload({
    //     schedule: scheduleForDispatch(newDispatch, newSchedule),
    //   }),
    // After the refactor, it's:
    //   ...dispatchPayload(),
    // The slice around the update branch must show the empty-arg form,
    // not the override-object form.
    const updateBranchMatch = source.match(
      /dispatchMissionAction\("update",\s*\{[\s\S]*?\}\s*\);/,
    );
    expect(updateBranchMatch).not.toBeNull();
    const slice = updateBranchMatch?.[0] ?? "";
    expect(slice).toMatch(/\.\.\.dispatchPayload\(\)/);
  });
});
