// orchestration/run-deadline.ts: when the reconciler stops waiting. These
// values were private to run-reconcile.ts, so the console could say nothing
// about a run but that it was still going, while the reconciler computed and
// threw away every tick the exact instant it would mark the run failed. Now
// run-reconcile imports them and `buildMissionRunView` publishes the same
// arithmetic to the mission API for the board.
//
// Two deadlines, distinguished by `declared`: the mission's own timeout,
// enforced even while the backend reports the run as started; or the safety
// cap, which bites only when the backend stops answering. An untimed mission
// the backend is happily running is long, not stuck.

import { MAX_TIMEOUT_MINUTES } from "@/lib/missions/mission-timeout";
import type { MissionRunView } from "@/lib/missions/mission-run-state";
import type { RunRecord } from "@/lib/runs-repository";

/** Slack added to every deadline before a run is treated as stuck. */
export const GRACE_MINUTES = 5;

/** Safety cap for a mission that declared no timeout of its own. */
export const DEFAULT_MAX_RUN_MINUTES = Math.max(
  10,
  Number(process.env.PS_RUN_MAX_MINUTES || process.env.CH_RUN_MAX_MINUTES) || 120,
);

/** Parse a run timestamp, tolerating the DB's tz-less form. NaN when unparseable. */
export function parseRunTimestamp(value: string): number {
  const hasTz = value.endsWith("Z") || /[+-]\d\d:\d\d$/.test(value);
  return Date.parse(hasTz ? value : `${value}Z`);
}

/** The mission fields the deadline depends on. `timeout` wins over `scope`. */
export interface DeadlineMission {
  timeoutMinutes?: number | null;
  missionTimeMinutes?: number | null;
}

/** The mission's declared max runtime in minutes, if it declared one. */
export function declaredTimeoutMinutes(mission: DeadlineMission | null): number | null {
  const t = mission?.timeoutMinutes ?? mission?.missionTimeMinutes;
  if (typeof t !== "number" || !(t > 0)) return null;
  // The belt for a row written before the boundary validated (T-0088): a stored
  // 1e9 used to BE the unreachable-backend cap, so the run never self-healed.
  return Math.min(t, MAX_TIMEOUT_MINUTES);
}

export interface RunDeadline {
  /** ISO instant at which the reconciler stops waiting. */
  at: string;
  /** True when it came from the mission's declared timeout, false when it is the safety cap. */
  declared: boolean;
}

/**
 * The instant the reconciler stops waiting for a run submitted at `submittedAt`.
 * Null when the timestamp cannot be parsed: a missing deadline beats one in 1970.
 */
export function runDeadline(
  submittedAt: string,
  declaredMinutes: number | null,
): RunDeadline | null {
  const start = parseRunTimestamp(submittedAt);
  if (!Number.isFinite(start)) return null;
  const capMinutes = (declaredMinutes ?? DEFAULT_MAX_RUN_MINUTES) + GRACE_MINUTES;
  return {
    at: new Date(start + capMinutes * 60_000).toISOString(),
    declared: declaredMinutes !== null,
  };
}

/**
 * The wire shape the mission board reads. The deadline is attached only while
 * the run is going: on a finished run it would render as an "overdue" badge.
 */
export function buildMissionRunView(
  mission: DeadlineMission | null,
  run: RunRecord | null,
): MissionRunView | null {
  if (!run) return null;
  const deadline =
    run.status === "started" ? runDeadline(run.submittedAt, declaredTimeoutMinutes(mission)) : null;
  return {
    id: run.id,
    status: run.status,
    submittedAt: run.submittedAt,
    completedAt: run.completedAt,
    error: run.error,
    deadlineAt: deadline?.at ?? null,
    deadlineDeclared: deadline?.declared ?? false,
  };
}
