/**
 * @jest-environment node
 *
 * Source-pattern test for the handleSave setTimeout-cleanup
 * refactor in src/app/config/[section]/page.tsx (session 185).
 *
 * Locks the shape of the `saveStatusTimerRef` + cleanup-effect +
 * back-to-back-pre-cancel pattern so a future "remove the
 * pre-cancel / inline the setTimeout" PR can't accidentally
 * re-introduce the back-to-back-save race that the ref-based
 * cleanup was added to fix.
 *
 * The pre-refactor form was:
 *   saveStatusTimerRef.current = setTimeout(() => setSaveStatus("idle"), 2000);
 * with no `if (ref.current) clearTimeout(ref.current)` guard
 * before the assignment. If the user clicked save twice in
 * rapid succession, the first timer's 2-second window would
 * still be in flight and would race the new timer — the
 * stale handle would fire setSaveStatus("idle") prematurely,
 * flipping the UI away from "Saved!" before the user could
 * read the indicator from the most recent save.
 *
 * The post-refactor shape is:
 *   if (saveStatusTimerRef.current) {
 *     clearTimeout(saveStatusTimerRef.current);
 *   }
 *   saveStatusTimerRef.current = setTimeout(() => {
 *     saveStatusTimerRef.current = null;
 *     setSaveStatus("idle");
 *   }, 2000);
 *
 * The pre-existing unmount-cleanup effect (lines 42-46) is
 * preserved unchanged.
 *
 * The test pins:
 *   1. `saveStatusTimerRef` is a useRef<setTimeout| null>(null) (positive)
 *   2. There's a useEffect with empty deps that returns a cleanup
 *      clearing the ref'd timer (positive)
 *   3. handleSave's setTimeout assigns to saveStatusTimerRef.current
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
 *   - The page is a 365-line client component with multiple
 *     useState / useEffect / useCallback / useMemo hooks and
 *     a dynamic form. A render harness would dwarf the invariant.
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
const FILE_PATH = join(REPO_ROOT, "src", "app", "config", "[section]", "page.tsx");

// Strip block + line comments so JSDoc-style prose notes
// (e.g. "setTimeout(() => setSaveStatus(\"idle\"), 2000);" in
// the ref's JSDoc) don't false-positive the negative assertion.
// Same pre-filter pattern as agents-page-save-reset-timer-cleanup.test.ts.
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

describe("config/[section]/page — saveStatusTimerRef + cleanup (session 185)", () => {
  const rawSource = readFileSync(FILE_PATH, "utf-8");
  const code = stripComments(rawSource);

  it("declares saveStatusTimerRef as a useRef<setTimeout| null>(null) (positive)", () => {
    const matches = code.match(
      /const\s+saveStatusTimerRef\s*=\s*useRef<ReturnType<typeof\s+setTimeout>\s*\|\s*null>\s*\(\s*null\s*\)/,
    );
    expect(matches).not.toBeNull();
  });

  it("has a useEffect with empty deps that returns a cleanup clearing the timer (positive)", () => {
    // The cleanup effect: matches the
    //   useEffect(() => { return () => { ... clearTimeout ... } }, []);
    // shape, but the cleanup body can be multi-line so use [\s\S]*?
    // to span lines. We require the cleanup to call clearTimeout
    // against saveStatusTimerRef.current.
    expect(code).toMatch(
      /useEffect\s*\(\s*\(\s*\)\s*=>\s*\{\s*return\s+(?:\(\s*\)\s*=>|function\s*\(\s*\))\s*\{[\s\S]*?clearTimeout\s*\(\s*saveStatusTimerRef\.current\s*\)/,
    );
  });

  it("handleSave's setTimeout assigns to saveStatusTimerRef.current (positive)", () => {
    // Pin the byte-shape of the new save handler: there must
    // be a `saveStatusTimerRef.current = setTimeout(...)` form
    // (the ref-assignment that makes the timer cleanable).
    expect(code).toMatch(
      /saveStatusTimerRef\.current\s*=\s*setTimeout\s*\(\s*\(\s*\)\s*=>\s*\{/,
    );
  });

  it("handleSave's setTimeout body nulls the ref + calls setSaveStatus(\"idle\") (positive)", () => {
    // The timer's body must:
    //   1. null the ref (so cleanup-effect doesn't try to clear
    //      an already-fired handle)
    //   2. call setSaveStatus("idle") (the original intent)
    // Both are inside the setTimeout arrow body.
    const timerAssignment = code.match(
      /saveStatusTimerRef\.current\s*=\s*setTimeout\s*\(\s*\(\s*\)\s*=>\s*\{([\s\S]*?)\}\s*,\s*2000\s*\)/,
    );
    expect(timerAssignment).not.toBeNull();
    const body = timerAssignment?.[1] ?? "";
    expect(body).toMatch(/saveStatusTimerRef\.current\s*=\s*null/);
    expect(body).toMatch(/setSaveStatus\s*\(\s*["']idle["']\s*\)/);
  });

  it("clears any in-flight timer before scheduling a new one (back-to-back save safety)", () => {
    // Before assigning to saveStatusTimerRef.current, the code
    // must clear any prior timer. The pre-refactor form did NOT
    // do this, so a back-to-back save could leave a stale timer
    // racing the new one. The pattern is:
    //   if (saveStatusTimerRef.current) {
    //     clearTimeout(saveStatusTimerRef.current);
    //   }
    //   saveStatusTimerRef.current = setTimeout(...)
    expect(code).toMatch(
      /if\s*\(\s*saveStatusTimerRef\.current\s*\)\s*\{[\s\S]*?clearTimeout\s*\(\s*saveStatusTimerRef\.current\s*\)[\s\S]*?\}/,
    );
  });

  it("does NOT contain a bare setTimeout(() => setSaveStatus(\"idle\"), 2000) outside the ref form (negative)", () => {
    // The pre-refactor form was:
    //   saveStatusTimerRef.current = setTimeout(() => setSaveStatus("idle"), 2000);
    // The post-refactor form is:
    //   saveStatusTimerRef.current = setTimeout(() => { ... }, 2000);
    // A new bare schedule site would mean the cleanup is bypassed
    // for that site. The assignment-to-ref form is the only allowed
    // form. Strip the `saveStatusTimerRef.current = ` prefix from
    // the source, then verify the bare form has 0 matches.
    const withoutAssignment = code.replace(
      /saveStatusTimerRef\.current\s*=\s*setTimeout/g,
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
