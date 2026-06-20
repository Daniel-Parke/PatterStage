// ═══════════════════════════════════════════════════════════════
// schedules-repository.ts — PatterStage-owned scheduler state
//
// A `schedule` row is the source of truth for "when should this mission run".
// The scheduler tick (orchestration/scheduler) reads due rows by next_run_at
// and dispatches a run via the runtime — PatterStage owns the timer, the agent
// does NOT (no Hermes jobs.json). Restart-safe: due work is recomputed from
// next_run_at, never an in-memory timer.
// ═══════════════════════════════════════════════════════════════

import { db, inTransaction, uuid, now } from "./db";
import { buildUpdate } from "./db/build-update";

export type CatchUpPolicy = "fire_once" | "skip";

export interface ScheduleRecord {
  id: string;
  missionId: string | null;
  name: string;
  /** Canonical 5-field cron or interval shorthand (e.g. "every 30m"). */
  schedule: string;
  scheduleDisplay: string;
  enabled: boolean;
  catchUpPolicy: CatchUpPolicy;
  /** null = repeat forever. */
  repeatTimes: number | null;
  repeatDone: number;
  profileName: string | null;
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastRunId: string | null;
  lastStatus: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ScheduleRow {
  id: string;
  mission_id: string | null;
  name: string;
  schedule: string;
  schedule_display: string;
  enabled: number;
  catch_up_policy: string;
  repeat_times: number | null;
  repeat_done: number;
  profile_name: string | null;
  next_run_at: string | null;
  last_run_at: string | null;
  last_run_id: string | null;
  last_status: string | null;
  created_at: string;
  updated_at: string;
}

function rowToSchedule(row: ScheduleRow | undefined): ScheduleRecord | null {
  if (!row) return null;
  return {
    id: row.id,
    missionId: row.mission_id,
    name: row.name,
    schedule: row.schedule,
    scheduleDisplay: row.schedule_display,
    enabled: row.enabled === 1,
    catchUpPolicy: (row.catch_up_policy as CatchUpPolicy) ?? "fire_once",
    repeatTimes: row.repeat_times,
    repeatDone: row.repeat_done,
    profileName: row.profile_name,
    nextRunAt: row.next_run_at,
    lastRunAt: row.last_run_at,
    lastRunId: row.last_run_id,
    lastStatus: row.last_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── Create ───────────────────────────────────────────────────

export interface CreateScheduleInput {
  missionId?: string | null;
  name?: string;
  schedule: string;
  scheduleDisplay?: string;
  enabled?: boolean;
  catchUpPolicy?: CatchUpPolicy;
  repeatTimes?: number | null;
  profileName?: string | null;
  nextRunAt?: string | null;
}

export function createSchedule(input: CreateScheduleInput): ScheduleRecord {
  const id = uuid();
  const ts = now();
  inTransaction(() => {
    db()
      .prepare(
        `INSERT INTO schedules
           (id, mission_id, name, schedule, schedule_display, enabled, catch_up_policy,
            repeat_times, repeat_done, profile_name, next_run_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.missionId ?? null,
        input.name ?? "",
        input.schedule,
        input.scheduleDisplay ?? "",
        input.enabled === false ? 0 : 1,
        input.catchUpPolicy ?? "fire_once",
        input.repeatTimes ?? null,
        input.profileName ?? null,
        input.nextRunAt ?? null,
        ts,
        ts,
      );
  });
  return getSchedule(id)!;
}

// ── Read ─────────────────────────────────────────────────────

export function getSchedule(id: string): ScheduleRecord | null {
  const row = db().prepare("SELECT * FROM schedules WHERE id = ?").get(id) as ScheduleRow | undefined;
  return rowToSchedule(row);
}

export function listSchedules(): ScheduleRecord[] {
  const rows = db()
    .prepare("SELECT * FROM schedules ORDER BY created_at DESC")
    .all() as ScheduleRow[];
  return rows.map(rowToSchedule).filter((s): s is ScheduleRecord => s !== null);
}

export function getScheduleForMission(missionId: string): ScheduleRecord | null {
  const row = db()
    .prepare("SELECT * FROM schedules WHERE mission_id = ? ORDER BY created_at DESC LIMIT 1")
    .get(missionId) as ScheduleRow | undefined;
  return rowToSchedule(row);
}

/** Enabled schedules whose next_run_at is due at or before `asOf` (ISO). */
export function getDueSchedules(asOf: string): ScheduleRecord[] {
  const rows = db()
    .prepare(
      `SELECT * FROM schedules
        WHERE enabled = 1
          AND next_run_at IS NOT NULL
          AND next_run_at <= ?
        ORDER BY next_run_at ASC`,
    )
    .all(asOf) as ScheduleRow[];
  return rows.map(rowToSchedule).filter((s): s is ScheduleRecord => s !== null);
}

// ── Update ───────────────────────────────────────────────────

export function updateSchedule(
  id: string,
  updates: {
    name?: string;
    schedule?: string;
    scheduleDisplay?: string;
    enabled?: boolean;
    catchUpPolicy?: CatchUpPolicy;
    repeatTimes?: number | null;
    profileName?: string | null;
    nextRunAt?: string | null;
  },
): ScheduleRecord | null {
  const { sql, values } = buildUpdate(
    {
      name: updates.name,
      schedule: updates.schedule,
      schedule_display: updates.scheduleDisplay,
      enabled: updates.enabled === undefined ? undefined : updates.enabled ? 1 : 0,
      catch_up_policy: updates.catchUpPolicy,
      repeat_times: updates.repeatTimes,
      profile_name: updates.profileName,
      next_run_at: updates.nextRunAt,
    },
    { now: now() },
  );
  inTransaction(() => {
    db().prepare(`UPDATE schedules SET ${sql} WHERE id = ?`).run(...values, id);
  });
  return getSchedule(id);
}

/**
 * Record a firing: advance next_run_at, bump repeat_done, stamp last_*.
 * Pass enabled:false to stop a finite schedule that has exhausted its repeats.
 */
export function advanceSchedule(
  id: string,
  fields: {
    nextRunAt: string | null;
    lastRunAt: string;
    lastRunId: string | null;
    lastStatus: string | null;
    incrementDone?: boolean;
    enabled?: boolean;
  },
): ScheduleRecord | null {
  const ts = now();
  const existing = getSchedule(id);
  if (!existing) return null;
  const { sql, values } = buildUpdate(
    {
      next_run_at: fields.nextRunAt,
      last_run_at: fields.lastRunAt,
      last_run_id: fields.lastRunId,
      last_status: fields.lastStatus,
      repeat_done: fields.incrementDone ? existing.repeatDone + 1 : undefined,
      enabled: fields.enabled === undefined ? undefined : fields.enabled ? 1 : 0,
    },
    { now: ts },
  );
  inTransaction(() => {
    db().prepare(`UPDATE schedules SET ${sql} WHERE id = ?`).run(...values, id);
  });
  return getSchedule(id);
}

export function deleteSchedule(id: string): boolean {
  const result = db().prepare("DELETE FROM schedules WHERE id = ?").run(id);
  return result.changes > 0;
}

/**
 * Remove every schedule linked to a mission. Called when a mission is deleted so
 * the scheduler tick never tries to dispatch a removed mission. Returns the
 * number of schedules deleted.
 */
export function deleteSchedulesForMission(missionId: string): number {
  const result = db().prepare("DELETE FROM schedules WHERE mission_id = ?").run(missionId);
  return result.changes;
}

/**
 * Record an out-of-band (manual "run now") dispatch on a schedule: stamp
 * last_run_* WITHOUT advancing next_run_at or the repeat counter (the cadence is
 * unchanged by a manual run). Used by POST /api/schedules/[id]/run; the final
 * status is reconciled later via runs.schedule_id by the run-reconcile tick.
 */
export function recordScheduleRun(
  id: string,
  fields: { lastRunId: string | null; lastRunAt: string; lastStatus: string | null },
): ScheduleRecord | null {
  const { sql, values } = buildUpdate(
    {
      last_run_id: fields.lastRunId,
      last_run_at: fields.lastRunAt,
      last_status: fields.lastStatus,
    },
    { now: now() },
  );
  inTransaction(() => {
    db().prepare(`UPDATE schedules SET ${sql} WHERE id = ?`).run(...values, id);
  });
  return getSchedule(id);
}
