/**
 * Tests for the chat page's `activeSession` reuse + `sanitiseFilename`
 * migration (session 104).
 *
 * The chat page previously had 3 sites of the inline
 * `sessions.find((s) => s.id === activeSessionId)` form:
 *   1. Line 134: `const activeSession = sessions.find(...)` — kept
 *      inline (preserves the session 94 effect-dependency analysis
 *      that intentionally does NOT use `useMemo` here)
 *   2. Line 238: `handleSend`'s `existing` lookup — migrated to reuse
 *      the top-level `activeSession` (the prior `activeSessionId ? find
 *      : undefined` ternary collapses to `activeSession` because the
 *      inline find returns `undefined` for the null-id case anyway)
 *   3. Line 478: JSX empty-state heading title — migrated to
 *      `activeSession?.title || "New Chat"` (the
 *      `sessions.find(...)?.title` was the same shape, just inlined
 *      twice)
 *
 * These tests are static-pattern tests — they read the chat page
 * source and assert the migration happened. This is the same pattern
 * the session 100 / 101 / 102 / 103 migrations used for
 * setter-callbacks (see `tests/unit/close-delete-setter-callback.test.ts`
 * for the canonical example).
 */
import * as fs from "fs";
import * as path from "path";

const CHAT_PAGE_PATH = path.join(
  process.cwd(),
  "src/app/orchestration/chat/page.tsx",
);

function readChatPage(): string {
  return fs.readFileSync(CHAT_PAGE_PATH, "utf-8");
}

describe("ChatPage — activeSession reuse + sanitiseFilename migration", () => {
  it("imports sanitiseFilename from @/lib/chat-utils", () => {
    const src = readChatPage();
    expect(src).toMatch(/import\s*\{[^}]*\bsanitiseFilename\b[^}]*\}\s*from\s*"@\/lib\/chat-utils"/);
  });

  it("calls sanitiseFilename in handleDownloadSession (no inline replace regex)", () => {
    const src = readChatPage();
    // The 1 call site is the `handleDownloadSession` callback. The
    // helper call is the byte-equivalent replacement for the prior
    // `s.title.replace(/[^a-zA-Z0-9_-]/g, "_")` inline regex.
    expect(src).toMatch(/sanitiseFilename\(\s*s\.title\s*\)/);
    // Anti-pattern lock: the inline `replace(/[^a-zA-Z0-9_-]/g, "_")`
    // form must not appear anywhere in the file. The migration moves
    // the rule into the helper.
    expect(src).not.toMatch(/\.replace\(\/\[\^a-zA-Z0-9_-\]\/g,\s*"_"\)/);
  });

  it("declares a top-level `activeSession` derivation on the session 94 path", () => {
    // The 1 canonical `sessions.find` site (line 134) is preserved
    // intentionally — see the session 94 analysis in
    // `references/session-94-...md` (it documents why promoting THIS
    // line to `useMemo` would change the auto-scroll effect's
    // dependency stability, not a byte-equivalent rename).
    const src = readChatPage();
    expect(src).toMatch(
      /const\s+activeSession\s*=\s*sessions\.find\(\(s\)\s*=>\s*s\.id\s*===\s*activeSessionId\)/,
    );
  });

  it("handleSend reuses the top-level `activeSession` (no second sessions.find)", () => {
    // The `existing` lookup in `handleSend` was the second `sessions.find`
    // site. After session 104, it's `const existing = activeSession;`
    // because the prior `activeSessionId ? find : undefined` ternary
    // collapses to `activeSession` (which is already `undefined` when
    // `activeSessionId` is null).
    const src = readChatPage();
    expect(src).toMatch(/const\s+existing\s*=\s*activeSession\s*;/);
  });

  it("JSX empty-state title uses `activeSession?.title` (no third sessions.find)", () => {
    // The third `sessions.find` site was in the JSX empty-state
    // heading. After session 104, it's `activeSession?.title || "New Chat"`.
    const src = readChatPage();
    expect(src).toMatch(/activeSession\?\.title\s*\|\|\s*"New Chat"/);
  });

  it("has exactly 1 inline `sessions.find` call site (the line 134 derivation)", () => {
    // The session 94 refactor documented that 2 inline `sessions.find`
    // call sites should be kept (the line 134 derivation + the JSX
    // site). After session 104, the JSX site is migrated away, leaving
    // exactly 1 inline `sessions.find` call site (the canonical
    // `activeSession` derivation on line 134). This is the byte-level
    // count of `sessions.find(` occurrences in the file.
    const src = readChatPage();
    const findCount = (src.match(/sessions\.find\(/g) ?? []).length;
    expect(findCount).toBe(1);
  });

  it("does not regress the session 94 inline-find contract (the comment is updated)", () => {
    // The comment on the `activeSession` derivation documents why the
    // inline find is preserved. Session 104 updates the comment to
    // note that the OTHER 2 sites were migrated to reuse this value.
    // The test asserts the comment is present (i.e., not removed) and
    // mentions the JSX + handleSend migrations.
    const src = readChatPage();
    expect(src).toMatch(/JSX empty-state title/);
    expect(src).toMatch(/handleSend.*existing/s);
  });
});
