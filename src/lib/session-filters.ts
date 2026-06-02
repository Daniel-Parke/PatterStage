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

import type { SessionRecord } from "@/lib/session-repository";

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
 * `sessionMatchesQuery`. Convenience wrapper for the common
 * `sessions.filter(s => sessionMatchesQuery(s, q))` pattern.
 */
export function searchSessionsByQuery(
  sessions: readonly SessionRecord[],
  query: string,
): SessionRecord[] {
  if (!query) return [...sessions];
  const q = query.toLowerCase();
  return sessions.filter(
    (s) =>
      (s.title?.toLowerCase() ?? "").includes(q) ||
      s.id.toLowerCase().includes(q) ||
      (s.profileName?.toLowerCase() ?? "").includes(q) ||
      (s.missionId?.toLowerCase() ?? "").includes(q),
  );
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
  if (session.size >= 1024) return false;
  const ageMs = now - new Date(session.startedAt).getTime();
  if (ageMs > 60_000) return false;
  return true;
}
