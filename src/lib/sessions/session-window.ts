// ═══════════════════════════════════════════════════════════════
// session-window.ts — Pure helpers for session-window math
// ═══════════════════════════════════════════════════════════════
//
// The dashboard shows a compact "active · last 7d" subtitle on the
// Sessions stat pill, derived from the most-recent 5 sessions synced
// via /api/monitor. The active-vs-recent distinction is a heuristic
// (a session modified in the last 5 minutes is "active") and lives in
// two time-window constants that callers should be able to tune.
//
// Extracted to a pure module so the math can be unit-tested in
// isolation from React (no need to render the dashboard to verify the
// counts).

/** Window used to mark a session as "active" on the dashboard. */
export const ACTIVE_WINDOW_MS = 5 * 60_000;

/** Window used to count "last 7d" sessions on the dashboard subtitle. */
export const RECENT_WINDOW_MS = 7 * 24 * 60 * 60_000;

/**
 * Subset of a session row that the window counter needs.
 * The dashboard's monitor payload only exposes `modified` (mtime), so
 * we accept any object that has an optional ISO/date-like `modified`.
 */
export interface SessionModified {
  modified?: string | null;
}

/**
 * Count how many of the given sessions fall inside a time window
 * measured backwards from `now`. Sessions without a `modified` field
 * (or with an unparseable value) are skipped — they don't contribute
 * to either bucket.
 *
 * @param sessions — recent session list
 * @param windowMs — window size in milliseconds
 * @param now      — reference time (defaults to `Date.now()`; pass an
 *                   explicit value in tests for determinism)
 */
export function countInWindow(
  sessions: readonly SessionModified[],
  windowMs: number,
  now: number = Date.now(),
): number {
  return sessions.reduce((acc, s) => {
    if (!s.modified) return acc;
    const t = new Date(s.modified).getTime();
    if (!Number.isFinite(t)) return acc;
    return acc + (now - t < windowMs ? 1 : 0);
  }, 0);
}
