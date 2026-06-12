/**
 * @jest-environment node
 *
 * Source-pattern test for the handleSave setTimeout-cleanup
 * refactor in src/app/operations/agents/page.tsx (session 184).
 *
 * Locks the shape of the `saveResetTimerRef` + cleanup-effect
 * pattern so a future "remove the useRef / inline the setTimeout"
 * PR can't accidentally re-introduce the unmount-during-timer
 * leak that the ref-based cleanup was added to fix.
 *
 * The pre-refactor form was:
 *   setTimeout(() => setSaveStatus("idle"), 2000);
 * with no cleanup. If the user navigated away (or the page
 * unmounted for any other reason) during the 2-second window,
 * the timer would still fire and call setSaveStatus on an
 * unmounted component, producing a React "state update on an
 * unmounted component" warning + a wasted re-render cycle.
 *
 * The post-refactor shape is:
 *   const saveResetTimerRef = useRef<...>(null);
 *   useEffect(() => () => {
 *     if (saveResetTimerRef.current) {
 *       clearTimeout(saveResetTimerRef.current);
 *       saveResetTimerRef.current = null;
 *     }
 *   }, []);
 *   // ...inside handleSave:
 *   if (saveResetTimerRef.current) {
 *     clearTimeout(saveResetTimerRef.current);
 *   }
 *   saveResetTimerRef.current = setTimeout(() => {
 *     saveResetTimerRef.current = null;
 *     setSaveStatus("idle");
 *   }, 2000);
 *
 * The test pins:
 *   1. `saveResetTimerRef` is a useRef<setTimeout| null>(null) (positive)
 *   2. There's a useEffect with empty deps that returns a cleanup
 *      clearing the ref'd timer (positive)
 *   3. handleSave's setTimeout assigns to saveResetTimerRef.current
 *      AND clears any prior timer before scheduling the new one
 *      (positive — back-to-back save safety)
 *   4. The body of the setTimeout nulls the ref + calls
 *      setSaveStatus("idle") (positive — preserves the original
 *      "idle reset" intent)
 *   5. There is NO bare `setTimeout(() => setSaveStatus("idle"), 2000)`
 *      outside the assignment-to-ref form (negative — would mean
 *      a new bare-schedule site was added without cleanup)
 *
 * Why source-pattern instead of rendering the page:
 *   - The page is a 651-line client component with 17 useState
 *     calls, 7 useCallback hooks, and multiple modals. A render
 *     harness would dwarf the invariant.
 *   - The "useRef + cleanup effect + setTimeout assigned to
 *     ref.current" shape is the byte-level contract.
 *
 * If the pattern is restructured (e.g. extracted into a shared
 * `useAutoResetTimer` hook), the file path and shape-string
 * assertions will need to be updated.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..");
const FILE_PATH = join(REPO_ROOT, "src", "app", "operations", "agents", "page.tsx");

// Strip block + line comments so JSDoc-style prose notes
// (e.g. "setTimeout(() => setSaveStatus(\"idle\"), 2000);" in
// the ref's JSDoc) don't false-positive the negative assertion.
// Same pre-filter pattern as the other operation-page tests.
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

describe("agents/page — saveResetTimerRef + cleanup (session 184)", () => {
  const rawSource = readFileSync(FILE_PATH, "utf-8");
  const code = stripComments(rawSource);

  it("declares saveResetTimerRef as a useRef<setTimeout| null>(null) (positive)", () => {
    const matches = code.match(
      /const\s+saveResetTimerRef\s*=\s*useRef<ReturnType<typeof\s+setTimeout>\s*\|\s*null>\s*\(\s*null\s*\)/,
    );
    expect(matches).not.toBeNull();
  });

  it("has a useEffect with empty deps that returns a cleanup clearing the timer (positive)", () => {
    // The cleanup effect: matches the
    //   useEffect(() => { return () => { ... clearTimeout ... } }, []);
    // shape, but the cleanup body can be multi-line so use [\s\S]*?
    // to span lines. We require the cleanup to (a) check that the
    // ref has a current timer handle and (b) call clearTimeout
    // and (c) null the ref to release the handle. We assert by
    // scanning for the key sub-patterns separately (a single
    // multi-line regex for the whole effect is brittle).
    expect(code).toMatch(
      /useEffect\s*\(\s*\(\s*\)\s*=>\s*\{\s*return\s+(?:\(\s*\)\s*=>|function\s*\(\s*\))\s*\{[\s\S]*?if\s*\(\s*saveResetTimerRef\.current\s*\)[\s\S]*?clearTimeout\s*\(\s*saveResetTimerRef\.current\s*\)/,
    );
    expect(code).toMatch(
      /useEffect\s*\(\s*\(\s*\)\s*=>\s*\{\s*return\s+(?:\(\s*\)\s*=>|function\s*\(\s*\))\s*\{[\s\S]*?saveResetTimerRef\.current\s*=\s*null/,
    );
  });

  it("handleSave's setTimeout assigns to saveResetTimerRef.current (positive)", () => {
    // Pin the byte-shape of the new save handler: there must
    // be a `saveResetTimerRef.current = setTimeout(...)` form
    // (the ref-assignment that makes the timer cleanable).
    expect(code).toMatch(
      /saveResetTimerRef\.current\s*=\s*setTimeout\s*\(\s*\(\s*\)\s*=>\s*\{/,
    );
  });

  it("handleSave's setTimeout body nulls the ref + calls setSaveStatus(\"idle\") (positive)", () => {
    // The timer's body must:
    //   1. null the ref (so cleanup-effect doesn't try to clear
    //      an already-fired handle)
    //   2. call setSaveStatus("idle") (the original intent)
    // Both are inside the setTimeout arrow body.
    const timerAssignment = code.match(
      /saveResetTimerRef\.current\s*=\s*setTimeout\s*\(\s*\(\s*\)\s*=>\s*\{([\s\S]*?)\}\s*,\s*2000\s*\)/,
    );
    expect(timerAssignment).not.toBeNull();
    const body = timerAssignment?.[1] ?? "";
    expect(body).toMatch(/saveResetTimerRef\.current\s*=\s*null/);
    expect(body).toMatch(/setSaveStatus\s*\(\s*["']idle["']\s*\)/);
  });

  it("clears any in-flight timer before scheduling a new one (back-to-back save safety)", () => {
    // Before assigning to saveResetTimerRef.current, the code
    // must clear any prior timer. The pre-refactor form did NOT
    // do this, so a back-to-back save could leave a stale timer
    // racing the new one. The pattern is:
    //   if (saveResetTimerRef.current) {
    //     clearTimeout(saveResetTimerRef.current);
    //   }
    //   saveResetTimerRef.current = setTimeout(...)
    expect(code).toMatch(
      /if\s*\(\s*saveResetTimerRef\.current\s*\)\s*\{[\s\S]*?clearTimeout\s*\(\s*saveResetTimerRef\.current\s*\)[\s\S]*?\}/,
    );
  });

  it("does NOT contain a bare setTimeout(() => setSaveStatus(\"idle\"), 2000) outside the ref form (negative)", () => {
    // The pre-refactor form was:
    //   setTimeout(() => setSaveStatus("idle"), 2000);
    // The post-refactor form is:
    //   saveResetTimerRef.current = setTimeout(() => { ... }, 2000);
    // A new bare schedule site would mean the cleanup is bypassed
    // for that site. The assignment-to-ref form is the only allowed
    // form. Strip the `saveResetTimerRef.current = ` prefix from
    // the source, then verify the bare form has 0 matches.
    const withoutAssignment =
      code.replace(
        /saveResetTimerRef\.current\s*=\s*setTimeout/g,
        "setTimeout",
      );
    // The negative: there should be 0 occurrences of
    // `setTimeout(() => setSaveStatus("idle"), 2000)` (the exact
    // pre-refactor shape). Note: the JSDoc comment in the helper
    // definition might mention the old form — the stripComments
    // pre-filter handles that.
    const bareMatches = withoutAssignment.match(
      /setTimeout\s*\(\s*\(\s*\)\s*=>\s*setSaveStatus\s*\(\s*["']idle["']\s*\)\s*,\s*2000\s*\)/g,
    );
    expect(bareMatches).toBeNull();
  });
});
