/**
 * @jest-environment node
 *
 * Source-pattern test for the PersonalityCard copiedTimerRef
 * unmount-cleanup addition in src/app/operations/personalities/page.tsx
 * (session 185).
 *
 * Locks the shape of the `copiedTimerRef` + cleanup-effect
 * pattern so a future "remove the useEffect cleanup / inline
 * the setTimeout" PR can't accidentally re-introduce the
 * unmount-during-timer leak that the ref-based cleanup was
 * added to fix.
 *
 * The pre-refactor form was:
 *   const copiedTimerRef = useRef<...>(null);
 *   const handleCopy = () => {
 *     if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
 *     navigator.clipboard.writeText(personality.prompt);
 *     setCopied(true);
 *     copiedTimerRef.current = setTimeout(() => {
 *       copiedTimerRef.current = null;
 *       setCopied(false);
 *     }, 2000);
 *   };
 * The pre-refactor form had only the inline back-to-back cancel.
 * If the card was removed from the DOM during the 2-second
 * window (e.g. parent re-renders without it, route change,
 * filtering hides the card), the timer would still fire and
 * call setCopied on an unmounted component, producing a React
 * "state update on an unmounted component" warning + a wasted
 * re-render cycle.
 *
 * The post-refactor shape adds a useEffect with empty deps
 * that returns a cleanup clearing the ref'd timer, matching
 * the copiedTimerRef pattern in components/session/MessageBubble.tsx
 * and the saveResetTimerRef pattern in operations/agents/page.tsx.
 *
 * The test pins:
 *   1. `copiedTimerRef` is a useRef<setTimeout| null>(null) (positive)
 *   2. There's a useEffect with empty deps that returns a cleanup
 *      clearing the ref'd timer AND nulling the ref (positive)
 *   3. handleCopy's setTimeout assigns to copiedTimerRef.current
 *      AND clears any prior timer before scheduling the new one
 *      (positive — back-to-back copy safety, was already in place)
 *   4. The body of the setTimeout nulls the ref + calls
 *      setCopied(false) (positive — preserves the original
 *      "copied reset" intent)
 *   5. There is NO bare `setTimeout(() => setCopied(false), 2000)`
 *      outside the assignment-to-ref form (negative — would mean
 *      a new bare-schedule site was added without cleanup)
 *
 * Why source-pattern instead of rendering the component:
 *   - PersonalityCard takes 4 props and uses 2 useState calls,
 *     1 useRef, and clipboard APIs. A render harness would
 *     require mocking the clipboard + DOM-removal. The shape
 *     of "useRef + cleanup effect + setTimeout assigned to
 *     ref.current" is the byte-level contract.
 *
 * If the pattern is restructured (e.g. extracted into a shared
 * `useAutoResetTimer` hook), the file path and shape-string
 * assertions will need to be updated.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..");
const FILE_PATH = join(
  REPO_ROOT,
  "src",
  "app",
  "operations",
  "personalities",
  "page.tsx",
);

// Strip block + line comments so JSDoc-style prose notes don't
// false-positive the negative assertion. Same pre-filter pattern
// as the other operation-page tests.
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

describe("personalities/page — PersonalityCard copiedTimerRef + cleanup (session 185)", () => {
  const rawSource = readFileSync(FILE_PATH, "utf-8");
  const code = stripComments(rawSource);

  it("declares copiedTimerRef as a useRef<setTimeout| null>(null) (positive)", () => {
    const matches = code.match(
      /const\s+copiedTimerRef\s*=\s*useRef<ReturnType<typeof\s+setTimeout>\s*\|\s*null>\s*\(\s*null\s*\)/,
    );
    expect(matches).not.toBeNull();
  });

  it("has a useEffect with empty deps that returns a cleanup clearing the timer + nulling the ref (positive)", () => {
    // The new cleanup effect: matches the
    //   useEffect(() => { return () => { ... clearTimeout ... } }, []);
    // shape, but the cleanup body can be multi-line so use [\s\S]*?
    // to span lines. We require the cleanup to (a) call clearTimeout
    // against copiedTimerRef.current and (b) null the ref to release
    // the handle. Asserting both via separate regexes keeps the
    // check robust against indentation / minor refactor drift.
    expect(code).toMatch(
      /useEffect\s*\(\s*\(\s*\)\s*=>\s*\{\s*return\s+(?:\(\s*\)\s*=>|function\s*\(\s*\))\s*\{[\s\S]*?clearTimeout\s*\(\s*copiedTimerRef\.current\s*\)/,
    );
    expect(code).toMatch(
      /useEffect\s*\(\s*\(\s*\)\s*=>\s*\{\s*return\s+(?:\(\s*\)\s*=>|function\s*\(\s*\))\s*\{[\s\S]*?copiedTimerRef\.current\s*=\s*null/,
    );
  });

  it("handleCopy's setTimeout assigns to copiedTimerRef.current (positive)", () => {
    // Pin the byte-shape of the copy handler: there must
    // be a `copiedTimerRef.current = setTimeout(...)` form
    // (the ref-assignment that makes the timer cleanable).
    expect(code).toMatch(
      /copiedTimerRef\.current\s*=\s*setTimeout\s*\(\s*\(\s*\)\s*=>\s*\{/,
    );
  });

  it("handleCopy's setTimeout body nulls the ref + calls setCopied(false) (positive)", () => {
    // The timer's body must:
    //   1. null the ref (so cleanup-effect doesn't try to clear
    //      an already-fired handle)
    //   2. call setCopied(false) (the original intent)
    const timerAssignment = code.match(
      /copiedTimerRef\.current\s*=\s*setTimeout\s*\(\s*\(\s*\)\s*=>\s*\{([\s\S]*?)\}\s*,\s*2000\s*\)/,
    );
    expect(timerAssignment).not.toBeNull();
    const body = timerAssignment?.[1] ?? "";
    expect(body).toMatch(/copiedTimerRef\.current\s*=\s*null/);
    expect(body).toMatch(/setCopied\s*\(\s*false\s*\)/);
  });

  it("clears any in-flight timer before scheduling a new one (back-to-back copy safety — pre-existing)", () => {
    // Before assigning to copiedTimerRef.current, the code
    // must clear any prior timer. This was already in place
    // before session 185, but pinning it locks the invariant
    // against future regressions that drop the pre-cancel.
    expect(code).toMatch(
      /if\s*\(\s*copiedTimerRef\.current\s*\)\s*clearTimeout\s*\(\s*copiedTimerRef\.current\s*\)/,
    );
  });

  it("does NOT contain a bare setTimeout(() => setCopied(false), 2000) outside the ref form (negative)", () => {
    // The pre-refactor form (post-back-to-back, pre-unmount-cleanup) was:
    //   copiedTimerRef.current = setTimeout(() => { ... }, 2000);
    // (with a body, not an inline arrow). The byte-equivalent rejection
    // is the bare single-line form that bypasses the ref. Strip the
    // `copiedTimerRef.current = ` prefix from the source, then verify
    // the bare form has 0 matches.
    const withoutAssignment = code.replace(
      /copiedTimerRef\.current\s*=\s*setTimeout/g,
      "setTimeout",
    );
    const bareMatches = withoutAssignment.match(
      /setTimeout\s*\(\s*\(\s*\)\s*=>\s*setCopied\s*\(\s*false\s*\)\s*,\s*2000\s*\)/g,
    );
    expect(bareMatches).toBeNull();
  });
});
