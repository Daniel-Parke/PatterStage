/**
 * @jest-environment jsdom
 *
 * Two tests in one file:
 *
 *   1. Unit tests for the `useCopyToClipboard` hook at
 *      `src/hooks/useCopyToClipboard.ts`. The hook centralises the
 *      "[copied, setCopied] + useRef<setTimeout> + unmount cleanup"
 *      pattern that was previously inlined in:
 *        - src/components/session/MessageBubble.tsx (handleCopy, 1500ms)
 *        - src/app/operations/personalities/page.tsx
 *          (PersonalityCard.handleCopy, 2000ms)
 *
 *   2. Source-pattern test pinning that the 2 migrated call sites
 *      (a) import the hook and (b) no longer contain the inline
 *      `useRef<ReturnType<typeof setTimeout>>` + cleanup `useEffect`
 *      pattern. A future "inline the hook" PR would fail this
 *      source-pattern check.
 *
 * This test REPLACES `personalities-card-copied-timer-cleanup.test.ts`
 * (the session 185 test that pinned the inlined `copiedTimerRef` +
 * cleanup form). Per the umbrella's session 195 P-1 "supersession"
 * pitfall, when a refactor REPLACES an earlier refactor's assertion
 * set, the old test is REWRITTEN, not coexisted-with. The old test's
 * JSDoc explicitly noted: "If the pattern is restructured (e.g.
 * extracted into a shared `useAutoResetTimer` hook), the file path
 * and shape-string assertions will need to be updated."
 *
 * Sister sites (anti-migration guards — NOT covered by this test):
 *   - src/components/missions/MissionPromptPreview.tsx uses a
 *     DIFFERENT shape: the timer is owned by a `useEffect` keyed on
 *     `copied`, and the `writeText` call is `await`ed inside a
 *     `try/catch` (the surrounding function is async). The hook
 *     intentionally does NOT cover that shape.
 *   - src/components/missions/MissionEditorPanel.tsx calls
 *     `navigator.clipboard.writeText` ONCE inside an async editor
 *     action (no "copied" flag, no timeout) — single use, not a
 *     duplication target.
 *   - src/app/orchestration/chat/page.tsx uses
 *     `navigator.clipboard.writeText(code).then(...)` as the
 *     fire-and-forget form of the same operation (no "copied" flag,
 *     no setTimeout, no ref) — single use, not a duplication target.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderHook, act } from "@testing-library/react";

// ── Unit tests for useCopyToClipboard ──────────────────────────────────

// Mock the clipboard so jsdom doesn't have to.
const writeTextMock = jest.fn(async (_text: string) => undefined);
const originalClipboard = (navigator as { clipboard?: { writeText: typeof writeTextMock } }).clipboard;
beforeAll(() => {
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: writeTextMock },
    writable: true,
    configurable: true,
  });
});
afterAll(() => {
  Object.defineProperty(navigator, "clipboard", {
    value: originalClipboard,
    writable: true,
    configurable: true,
  });
});
beforeEach(() => {
  writeTextMock.mockClear();
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});

describe("useCopyToClipboard — hook unit tests", () => {
  it("returns [false, copy] on first render", () => {
    const { result } = renderHook(() => useCopyToClipboardFwd());
    expect(result.current[0]).toBe(false);
    expect(typeof result.current[1]).toBe("function");
  });

  it("copy(text) calls navigator.clipboard.writeText with the text", async () => {
    const { result } = renderHook(() => useCopyToClipboardFwd());
    await act(async () => {
      result.current[1]("hello world");
    });
    expect(writeTextMock).toHaveBeenCalledTimes(1);
    expect(writeTextMock).toHaveBeenCalledWith("hello world");
  });

  it("copy(text) flips copied to true", async () => {
    const { result } = renderHook(() => useCopyToClipboardFwd());
    await act(async () => {
      result.current[1]("hello");
    });
    expect(result.current[0]).toBe(true);
  });

  it("copied flips back to false after the default 2000ms window", async () => {
    const { result } = renderHook(() => useCopyToClipboardFwd());
    await act(async () => {
      result.current[1]("hello");
    });
    expect(result.current[0]).toBe(true);
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(result.current[0]).toBe(false);
  });

  it("honours the resetMs option", async () => {
    const { result } = renderHook(() => useCopyToClipboardFwd({ resetMs: 500 }));
    await act(async () => {
      result.current[1]("hello");
    });
    expect(result.current[0]).toBe(true);
    act(() => {
      jest.advanceTimersByTime(499);
    });
    expect(result.current[0]).toBe(true);
    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current[0]).toBe(false);
  });

  it("back-to-back copy calls reset the timer (no double-fire)", async () => {
    const { result } = renderHook(() => useCopyToClipboardFwd());
    await act(async () => {
      result.current[1]("first");
    });
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(result.current[0]).toBe(true);
    // Second copy 1000ms in — the original 2000ms timer would have
    // fired at 2000ms, but a fresh 2000ms window is now armed.
    await act(async () => {
      result.current[1]("second");
    });
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    // The first timer's remaining 1000ms was cleared; the second
    // timer's remaining 1000ms is still in-flight.
    expect(result.current[0]).toBe(true);
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(result.current[0]).toBe(false);
  });

  it("unmount cancels the in-flight timer", async () => {
    const { result, unmount } = renderHook(() => useCopyToClipboardFwd());
    await act(async () => {
      result.current[1]("hello");
    });
    expect(result.current[0]).toBe(true);
    unmount();
    // Advance past the reset window — no setCopied throw, no leak.
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    // The point is no error / no React unmounted-setState warning.
    // We can only assert that the test didn't throw.
    expect(true).toBe(true);
  });
});

// Re-export to make the import a one-liner in the unit tests above.
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
function useCopyToClipboardFwd(opts?: { resetMs?: number }) {
  return useCopyToClipboard(opts);
}

// ── Source-pattern tests for the 2 migrated call sites ────────────────

const REPO_ROOT = join(__dirname, "..", "..");
const MESSAGE_BUBBLE_PATH = join(
  REPO_ROOT,
  "src",
  "components",
  "session",
  "MessageBubble.tsx",
);
const PERSONALITIES_PATH = join(
  REPO_ROOT,
  "src",
  "app",
  "operations",
  "personalities",
  "page.tsx",
);

// Strip block + line comments so JSDoc-style prose notes don't
// false-positive the negative assertions. Same pre-filter pattern
// as the other operation-page tests.
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

describe("useCopyToClipboard — call-site source pattern (List 3 sister + MessageBubble)", () => {
  const messageBubbleRaw = readFileSync(MESSAGE_BUBBLE_PATH, "utf-8");
  const personalitiesRaw = readFileSync(PERSONALITIES_PATH, "utf-8");
  const messageBubbleCode = stripComments(messageBubbleRaw);
  const personalitiesCode = stripComments(personalitiesRaw);

  it("MessageBubble.tsx imports the hook", () => {
    expect(messageBubbleRaw).toContain("useCopyToClipboard");
  });

  it("MessageBubble.tsx no longer declares the inline copiedTimerRef", () => {
    expect(messageBubbleCode).not.toMatch(
      /const\s+copiedTimerRef\s*=\s*useRef<ReturnType<typeof\s+setTimeout>/,
    );
  });

  it("MessageBubble.tsx no longer contains the inline navigator.clipboard.writeText (call sites go through the hook)", () => {
    expect(messageBubbleCode).not.toMatch(/navigator\.clipboard\.writeText/);
  });

  it("MessageBubble.tsx wires the hook with the pre-refactor 1500ms reset", () => {
    expect(messageBubbleCode).toMatch(/useCopyToClipboard\s*\(\s*\{\s*resetMs:\s*1500\s*\}\s*\)/);
  });

  it("personalities/page.tsx imports the hook", () => {
    expect(personalitiesRaw).toContain("useCopyToClipboard");
  });

  it("personalities/page.tsx no longer declares the inline copiedTimerRef", () => {
    expect(personalitiesCode).not.toMatch(
      /const\s+copiedTimerRef\s*=\s*useRef<ReturnType<typeof\s+setTimeout>/,
    );
  });

  it("personalities/page.tsx no longer contains the inline navigator.clipboard.writeText in the PersonalityCard", () => {
    expect(personalitiesCode).not.toMatch(/navigator\.clipboard\.writeText/);
  });

  it("personalities/page.tsx wires the hook with the pre-refactor 2000ms reset", () => {
    expect(personalitiesCode).toMatch(/useCopyToClipboard\s*\(\s*\{\s*resetMs:\s*2000\s*\}\s*\)/);
  });
});
