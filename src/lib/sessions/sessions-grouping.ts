// ═══════════════════════════════════════════════════════════════
// sessions-grouping.ts — Pure helpers for the Sessions list page
// ═══════════════════════════════════════════════════════════════
//
// The Sessions list page (src/app/(main)/sessions/page.tsx) supports
// a "Group by mission" toggle that collapses sessions sharing a
// missionId into a single expandable card. The grouping logic is a
// 50-line pure function that operates on `SessionRecord[]` and a
// boolean toggle, and is a prime candidate for:
//   - unit testing without rendering the page
//   - reuse from any future surface that needs the same
//     "collapse recurring-mission sessions into one card" shape
//     (e.g. the Mission detail page, a future Dashboard widget)
//
// Extracted from the page so the function lives in a single place
// and the page JSX stays a pure render of the precomputed entries.

import type { SessionRecord } from "@/lib/sessions/session-repository";

/** A session card rendered as part of a mission group (collapsed or expanded). */
export interface MissionGroup {
  kind: "mission";
  key: string;
  missionId: string;
  sessions: SessionRecord[];
  firstStartedAt: string;
  lastStartedAt: string;
  activeCount: number;
}

/** A single session card rendered as its own row. */
interface SingleSession {
  kind: "session";
  key: string;
  session: SessionRecord;
}

export type ListEntry = MissionGroup | SingleSession;

/**
 * Build the list-of-entries that the Sessions page renders. When
 * `groupByMission` is false, the result is the input sessions
 * 1:1, in their original order. When true, sessions sharing a
 * missionId are collapsed into a single `MissionGroup` row, and
 * standalone (no-missionId) sessions are emitted as their own
 * `SingleSession` rows. The final sort is mission groups first
 * (by last activity, newest first), then standalone (by startedAt,
 * newest first).
 *
 * Pure function. The input is not mutated.
 */
export function buildGroupedEntries(
  sessions: readonly SessionRecord[],
  groupByMission: boolean,
): ListEntry[] {
  if (!groupByMission) {
    return sessions.map((s) => ({ kind: "session", key: s.id, session: s }));
  }

  const missionGroups = new Map<string, SessionRecord[]>();
  const standalone: SessionRecord[] = [];

  for (const s of sessions) {
    if (s.missionId) {
      const list = missionGroups.get(s.missionId) ?? [];
      list.push(s);
      missionGroups.set(s.missionId, list);
    } else {
      standalone.push(s);
    }
  }

  const entries: ListEntry[] = [];
  for (const [missionId, list] of missionGroups.entries()) {
    // Sort within group: newest first
    list.sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
    const firstStartedAt = list[list.length - 1].startedAt;
    const lastStartedAt = list[0].startedAt;
    const activeCount = list.filter((s) => s.status === "active").length;
    entries.push({
      kind: "mission",
      key: `mission:${missionId}`,
      missionId,
      sessions: list,
      firstStartedAt,
      lastStartedAt,
      activeCount,
    });
  }
  for (const s of standalone) {
    entries.push({ kind: "session", key: s.id, session: s });
  }

  // Sort entries: mission groups first (by last activity), then standalone
  entries.sort((a, b) => {
    const aTime = a.kind === "mission" ? a.lastStartedAt : a.session.startedAt;
    const bTime = b.kind === "mission" ? b.lastStartedAt : b.session.startedAt;
    return aTime < bTime ? 1 : -1;
  });

  return entries;
}
