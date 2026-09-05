// ═══════════════════════════════════════════════════════════════
// mission-schedule-view.ts — a mission's schedule, as the API publishes it
// ═══════════════════════════════════════════════════════════════
//
// The panel had a "Cron Job" card and the board had a cron badge, both behind
// `mission.cronJob`, and nothing has ever populated that field: the card and
// the badge were dead code (T-0104, D68). The thing they describe is not a
// Hermes cron job any more either. PatterStage owns the timer, in the
// `schedules` table, and the composer's Schedule dispatch mode writes a row
// there. So the field is renamed to what it is, and this is its shape.

import type { ScheduleRecord } from "@/lib/schedules-repository";

/** A mission's schedule, as /api/missions publishes it. */
export interface MissionScheduleView {
  id: string;
  /** The mission this schedule fires, or null for an orphan. */
  missionId: string | null;
  name: string;
  /** Canonical cron or interval shorthand, e.g. "every 30m". */
  schedule: string;
  /** Human cadence text; may be empty, in which case callers fall back to `schedule`. */
  scheduleDisplay: string;
  enabled: boolean;
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastStatus: string | null;
  repeatTimes: number | null;
  repeatDone: number;
}

/** The ten fields the client uses, and not the six it does not. */
export function toMissionScheduleView(row: ScheduleRecord | null): MissionScheduleView | null {
  if (!row) return null;
  return {
    id: row.id,
    missionId: row.missionId,
    name: row.name,
    schedule: row.schedule,
    scheduleDisplay: row.scheduleDisplay,
    enabled: row.enabled,
    nextRunAt: row.nextRunAt,
    lastRunAt: row.lastRunAt,
    lastStatus: row.lastStatus,
    repeatTimes: row.repeatTimes,
    repeatDone: row.repeatDone,
  };
}

/**
 * Why this schedule will not fire, or null when it will.
 *
 * "Scheduled" and "going to happen" are not the same thing, and the panel used
 * to show a next-run time for a schedule that had been paused, orphaned or
 * used up. The four reasons here are the four that are derivable from what is
 * recorded; the tick's own refusals (another mission is running, the spend
 * stop is armed) are not recorded anywhere, so they are not claimed here.
 *
 * Precedence is the order below: an orphan that is also paused says it is an
 * orphan, because that is the one the operator has to fix first.
 */
export function describeScheduleFiring(s: MissionScheduleView): string | null {
  if (s.missionId === null) return "No linked mission, so this schedule cannot fire.";
  if (!s.enabled) return "Paused. It will not fire until you resume it.";
  if (s.repeatTimes !== null && s.repeatDone >= s.repeatTimes) {
    return `Finished: it has run all ${s.repeatTimes} times it was set to run.`;
  }
  if (s.nextRunAt === null) return "No next run is set, so it will not fire again.";
  return null;
}
