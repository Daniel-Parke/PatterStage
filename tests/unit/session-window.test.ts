// Unit tests for the session-window counter
// (src/lib/sessions/session-window.ts)

import {
  countInWindow,
  ACTIVE_WINDOW_MS,
  RECENT_WINDOW_MS,
  type SessionModified,
} from "@/lib/sessions/session-window";

const FIXED_NOW = new Date("2026-06-02T12:00:00Z").getTime();

function modifiedAgo(ms: number): SessionModified {
  return { modified: new Date(FIXED_NOW - ms).toISOString() };
}

describe("countInWindow", () => {
  it("returns 0 for an empty list", () => {
    expect(countInWindow([], ACTIVE_WINDOW_MS, FIXED_NOW)).toBe(0);
  });

  it("counts a session inside the window", () => {
    const sessions: SessionModified[] = [modifiedAgo(60_000)]; // 1 min ago
    expect(countInWindow(sessions, ACTIVE_WINDOW_MS, FIXED_NOW)).toBe(1);
  });

  it("excludes a session outside the window", () => {
    const sessions: SessionModified[] = [modifiedAgo(10 * 60_000)]; // 10 min ago
    expect(countInWindow(sessions, ACTIVE_WINDOW_MS, FIXED_NOW)).toBe(0);
  });

  it("skips sessions with no `modified` field", () => {
    const sessions: SessionModified[] = [{ modified: null }];
    expect(countInWindow(sessions, ACTIVE_WINDOW_MS, FIXED_NOW)).toBe(0);
  });

  it("skips sessions with an unparseable `modified`", () => {
    const sessions: SessionModified[] = [{ modified: "not-a-date" }];
    expect(countInWindow(sessions, ACTIVE_WINDOW_MS, FIXED_NOW)).toBe(0);
  });

  it("counts across both windows independently", () => {
    // Two minutes ago — inside ACTIVE (5m) and inside RECENT (7d)
    const sessions: SessionModified[] = [modifiedAgo(2 * 60_000)];
    expect(countInWindow(sessions, ACTIVE_WINDOW_MS, FIXED_NOW)).toBe(1);
    expect(countInWindow(sessions, RECENT_WINDOW_MS, FIXED_NOW)).toBe(1);
  });

  it("treats boundary as exclusive (now - modified === windowMs → excluded)", () => {
    const sessions: SessionModified[] = [modifiedAgo(ACTIVE_WINDOW_MS)];
    expect(countInWindow(sessions, ACTIVE_WINDOW_MS, FIXED_NOW)).toBe(0);
  });

  it("uses Date.now() when no `now` is supplied (smoke test)", () => {
    // Anchor the fixture to *now* (not FIXED_NOW) so the test stays
    // deterministic regardless of when it runs. The "0 ms ago" session
    // must be within ACTIVE_WINDOW_MS of Date.now() by definition.
    const sessions: SessionModified[] = [
      { modified: new Date(Date.now()).toISOString() },
    ];
    expect(countInWindow(sessions, ACTIVE_WINDOW_MS)).toBe(1);
  });
});

describe("window constants", () => {
  it("ACTIVE_WINDOW_MS is 5 minutes", () => {
    expect(ACTIVE_WINDOW_MS).toBe(5 * 60_000);
  });

  it("RECENT_WINDOW_MS is 7 days", () => {
    expect(RECENT_WINDOW_MS).toBe(7 * 24 * 60 * 60_000);
  });
});
