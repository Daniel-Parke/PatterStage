// session-filters.ts — pure helpers for the Sessions page's two filter passes:
// free-text search, and the opt-in "hide API noise" toggle.

import type { SessionRecord } from "@/lib/sessions/session-repository";

/** @public The size below which an api session is chatter. Shared with the SQL. */
export const API_NOISE_MAX_BYTES = 1024;

/** @public How long an api session may LIVE and still be chatter. Shared with the SQL. */
export const API_NOISE_MAX_DURATION_MS = 60_000;

/** Case-insensitive match over title, id, profile and mission; an empty query matches all. */
export function sessionMatchesQuery(session: SessionRecord, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  if (session.title?.toLowerCase().includes(q)) return true;
  if (session.id.toLowerCase().includes(q)) return true;
  if (session.profileName?.toLowerCase().includes(q)) return true;
  if (session.missionId?.toLowerCase().includes(q)) return true;
  return false;
}

/** The sessions matching `query` per `sessionMatchesQuery`; an empty query returns a copy. */
export function searchSessionsByQuery(
  sessions: readonly SessionRecord[],
  query: string,
): SessionRecord[] {
  if (!query) return [...sessions];
  return sessions.filter((s) => sessionMatchesQuery(s, query));
}

/**
 * An "API noise" session: api-source, under a minute lived, under 1KB of
 * transcript. They dominate the list during Hindsight stress testing, so the
 * page offers a toggle. `now` defaults to `Date.now()`; tests pass one.
 */
export function isApiNoiseSession(
  session: SessionRecord,
  now: number = Date.now(),
): boolean {
  if (session.source !== "api") return false;
  if (session.size >= API_NOISE_MAX_BYTES) return false;
  // How long it LIVED, not how long ago it started: measuring age hid a
  // five-hour api session for its first minute and showed it for ever after
  // (T-0105, D31). The SQL in listSessions is what runs; this is the same rule, testable without a DB.
  const endMs = session.endedAt ? Date.parse(session.endedAt) : now;
  const durationMs = endMs - Date.parse(session.startedAt);
  if (durationMs > API_NOISE_MAX_DURATION_MS) return false;
  return true;
}
