// ═══════════════════════════════════════════════════════════════
// session-filters.ts — Pure helpers for session list filtering
// ═══════════════════════════════════════════════════════════════
//
// The Sessions page has two filter passes:
//   1. free-text search across title / id / profile / mission
//   2. an opt-in "hide API noise" toggle that drops short-lived
//      api-source sessions (< 1KB and < 1 minute old)
//
// Extracted from src/app/(main)/sessions/page.tsx so the predicates
// are unit-testable in isolation. Keeping them pure (no React) means
// the test suite can verify edge cases like null missionId, exact
// boundary ages, and case-insensitive matching without rendering the
// full page.

import type { SessionRecord } from "@/lib/sessions/session-repository";

/** Threshold (in bytes) below which an api-source session is considered "noise". */
/** @public The size below which an api session is chatter. Shared with the SQL. */
export const API_NOISE_MAX_BYTES = 1024;

/** Age (in milliseconds) below which a short-lived session is considered "noise". */
/** @public How long an api session may LIVE and still be chatter. Shared with the SQL. */
export const API_NOISE_MAX_DURATION_MS = 60_000;

/**
 * Free-text search across a session's title, id, profile, and mission
 * fields. Case-insensitive. Empty/whitespace queries return the input
 * unchanged. The id is always present (non-nullable in the schema);
 * the other fields are nullable and treated as empty for matching.
 */
export function sessionMatchesQuery(session: SessionRecord, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  if (session.title?.toLowerCase().includes(q)) return true;
  if (session.id.toLowerCase().includes(q)) return true;
  if (session.profileName?.toLowerCase().includes(q)) return true;
  if (session.missionId?.toLowerCase().includes(q)) return true;
  return false;
}

/**
 * Returns the subset of `sessions` that match `query` per
 * `sessionMatchesQuery`. Implemented in terms of the single-record
 * predicate so the case-insensitive matching logic lives in exactly
 * one place. Empty queries return a defensive copy of the input.
 */
export function searchSessionsByQuery(
  sessions: readonly SessionRecord[],
  query: string,
): SessionRecord[] {
  if (!query) return [...sessions];
  return sessions.filter((s) => sessionMatchesQuery(s, query));
}

/**
 * Heuristic: an "API noise" session is a short-lived api-source
 * session that completed in under a minute AND produced under 1KB
 * of transcript. These dominate the list during heavy Hindsight
 * stress testing, so the Sessions page offers an opt-in toggle to
 * hide them.
 *
 * `now` defaults to `Date.now()`; pass an explicit value in tests.
 */
export function isApiNoiseSession(
  session: SessionRecord,
  now: number = Date.now(),
): boolean {
  if (session.source !== "api") return false;
  if (session.size >= API_NOISE_MAX_BYTES) return false;
  // How long it LIVED, not how long ago it started. Measuring the age hid a
  // five-hour api session for its first minute and showed it for ever after
  // (T-0105, D31). The SQL in listSessions is the one that runs in the
  // product; this stays as the same rule, testable without a database.
  const endMs = session.endedAt ? Date.parse(session.endedAt) : now;
  const durationMs = endMs - Date.parse(session.startedAt);
  if (durationMs > API_NOISE_MAX_DURATION_MS) return false;
  return true;
}
