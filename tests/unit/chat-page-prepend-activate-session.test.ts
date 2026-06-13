/**
 * @jest-environment node
 *
 * Source-pattern test for the session-197 prependAndActivateSession
 * refactor in src/app/orchestration/chat/page.tsx.
 *
 * The pre-session source had the 2-line pattern
 *   setSessions((prev) => [newSession, ...prev]);
 *   setActiveSessionId(newSession.id);
 * at 2 sites:
 *   - `handleNewChat` (the "New Chat" button — line 193–194 in the
 *     pre-session file) — the 2 setters appear consecutively with no
 *     interleaved statements
 *   - `handleSend`'s `if (newSession)` branch (line 275–276) — the
 *     2 setters appear consecutively inside the branch with no
 *     interleaved statements
 *
 * After the refactor, both sites call a single
 * `prependAndActivateSession(newSession)` helper, and the inline
 * 2-line form is gone (it now lives only inside the helper body).
 *
 * Why source-pattern instead of rendering the page:
 *   - The chat page is a 600+ line client component that consumes
 *     `useGatewayHealth` + `useToast` + ~10 `useState` slots. Rendering
 *     it requires mocking all of those — overkill for a 2-setter pure
 *     function whose body is `setSessions((prev) => [x, ...prev]);
 *     setActiveSessionId(x.id);`.
 *   - The "useCallback with empty deps calling the 2-setter sequence"
 *     shape is the byte-level contract.
 *
 * What this test does NOT lock:
 *   - The `onClick={() => setActiveSessionId(s.id)}` JSX site at line
 *     ~454 (selecting an existing session from the sidebar). That site
 *     is a 1-setter `() => setActiveSessionId(<id>)` — DIFFERENT
 *     shape (the helper is the 2-setter prepend-then-activate, not a
 *     1-setter activate-by-id).
 *   - The `setActiveSessionId(null)` site in `handleDeleteSession` (a
 *     1-setter clear-the-active form, not a prepend-then-activate).
 *   - The `setActiveSessionId(saved[0].id)` site in the load effect
 *     (initial-load, no `setSessions` to accompany it — different
 *     shape, not a 2-setter prepend).
 *
 * If the helper is restructured (e.g. moved into a shared
 * `useSessionList` hook, or replaced with a reducer), the file path
 * and shape-string assertions will need to be updated — the test's
 * failure will then force the refactor author to consciously decide
 * whether the new shape preserves the 2-setter + empty-deps invariant.
 */

import * as fs from "fs";
import * as path from "path";

const CHAT_PAGE_PATH = path.resolve(
  __dirname,
  "../../src/app/orchestration/chat/page.tsx",
);

describe("prependAndActivateSession callback (session 197)", () => {
  const source = fs.readFileSync(CHAT_PAGE_PATH, "utf8");

  // Strip block + line comments so a JSDoc comment that mentions the
  // pre-session form doesn't pollute the regex matches. The pre-session
  // source's 2 sites appear in actual code, not comments, so this
  // filtering is safe and necessary.
  const codeOnly = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((l) => l.replace(/\/\/.*$/, ""))
    .join("\n");

  it("declares prependAndActivateSession as a useCallback taking a ChatSession arg with empty deps", () => {
    // The helper signature must be:
    //   const prependAndActivateSession = useCallback((newSession: ChatSession) => { ... }, []);
    // The deps array is `[]` because both `setSessions` and
    // `setActiveSessionId` are stable useState setters.
    expect(source).toMatch(
      /const\s+prependAndActivateSession\s*=\s*useCallback\(\s*\(\s*newSession\s*:\s*ChatSession\s*\)\s*=>\s*\{[\s\S]*?,\s*\[\s*\]\s*\)\s*;/,
    );
  });

  it("uses empty deps array (useState setters are stable)", () => {
    // The explicit empty-deps invariant — same pattern as the session
    // 196 close-callback tests. Use [\s\S]*? not [^)]* — see
    // session-start-pickup pitfall S1 (the `[^)]*` form truncates at
    // the first `)` in the function body).
    expect(source).toMatch(
      /const\s+prependAndActivateSession\s*=\s*useCallback\([\s\S]*?,\s*\[\s*\]\s*\)\s*;/,
    );
  });

  it("replaces both inline 2-line (setSessions + setActiveSessionId) sites in the 2 handlers", () => {
    // The pre-session 2 sites had the EXACT shape:
    //   setSessions((prev) => [newSession, ...prev]);
    //   setActiveSessionId(newSession.id);
    // The discriminator for "still inline" is the literal `[newSession,
    // ...prev]` form. After the refactor, this form must appear EXACTLY
    // ONCE in the file (inside the helper body), and never at the
    // call-site level.
    const prependFormMatches =
      codeOnly.match(/setSessions\(\(prev\)\s*=>\s*\[\s*newSession\s*,\s*\.\.\.prev\s*\]\s*\)/g) ?? [];
    expect(prependFormMatches.length).toBe(1);

    // The companion `setActiveSessionId(newSession.id)` form (the
    // exact `newSession.id` arg, not `<someOtherId>.id`) appears in
    // 3 places after the refactor:
    //   1. The helper body (lines after the prepend)
    //   2. The helper JSDoc example (filtered out by codeOnly)
    //   3. ... and that's it (the 2 call sites use the helper now)
    // So in codeOnly: EXACTLY 1 occurrence (the helper body).
    const activateFormMatches =
      codeOnly.match(/setActiveSessionId\(\s*newSession\.id\s*\)/g) ?? [];
    expect(activateFormMatches.length).toBe(1);

    // 1 declaration + 2 call sites = 3.
    const helperIdMatches = codeOnly.match(/\bprependAndActivateSession\b/g) ?? [];
    expect(helperIdMatches.length).toBeGreaterThanOrEqual(3);
  });

  it("migrates handleNewChat's 2-setter pair to the helper call", () => {
    // The 2-line sequence in `handleNewChat` used to be:
    //   setSessions((prev) => [newSession, ...prev]);
    //   setActiveSessionId(newSession.id);
    // After the refactor, `handleNewChat`'s body must contain a
    // `prependAndActivateSession(newSession)` call. The handleNewChat
    // callback body is the slice from the `const handleNewChat =
    // useCallback` declaration to the next `const <name> =
    // useCallback` (or `}, [<deps>])`).
    const handleNewChatIdx = codeOnly.indexOf("const handleNewChat =");
    expect(handleNewChatIdx).toBeGreaterThan(-1);
    const handleNewChatSlice = codeOnly.slice(handleNewChatIdx, handleNewChatIdx + 800);
    expect(handleNewChatSlice).toMatch(
      /prependAndActivateSession\(\s*newSession\s*\)/,
    );
    // The inline 2-line form must NOT appear inside handleNewChat.
    expect(handleNewChatSlice).not.toMatch(
      /setSessions\(\(prev\)\s*=>\s*\[\s*newSession\s*,\s*\.\.\.prev\s*\]\s*\)/,
    );
    expect(handleNewChatSlice).not.toMatch(
      /setActiveSessionId\(\s*newSession\.id\s*\)/,
    );
  });

  it("migrates handleSend's `if (newSession)` branch to the helper call", () => {
    // The 2-line sequence in `handleSend`'s `if (newSession)` branch
    // used to be:
    //   setSessions((prev) => [newSession, ...prev]);
    //   setActiveSessionId(newSession.id);
    // After the refactor, the branch body must contain a
    // `prependAndActivateSession(newSession)` call.
    const handleSendIdx = codeOnly.indexOf("const handleSend =");
    expect(handleSendIdx).toBeGreaterThan(-1);
    const handleSendSlice = codeOnly.slice(
      handleSendIdx,
      handleSendIdx + 1500,
    );
    expect(handleSendSlice).toMatch(
      /prependAndActivateSession\(\s*newSession\s*\)/,
    );
    // The inline 2-line form must NOT appear inside handleSend (the
    // 1500-char window is wide enough to cover the relevant branch
    // and the call to prependAndActivateSession, but the pre-session
    // pair would be in the first 600 chars of the slice).
    expect(handleSendSlice).not.toMatch(
      /setSessions\(\(prev\)\s*=>\s*\[\s*newSession\s*,\s*\.\.\.prev\s*\]\s*\)/,
    );
    expect(handleSendSlice).not.toMatch(
      /setActiveSessionId\(\s*newSession\.id\s*\)/,
    );
  });
});
