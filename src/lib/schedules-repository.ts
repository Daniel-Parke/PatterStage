// ═══════════════════════════════════════════════════════════════
// schedules-repository.ts — PatterStage-owned scheduler state
//
// A `schedule` row is the source of truth for "when should this mission run".
// The scheduler tick (orchestration/scheduler) reads due rows by next_run_at
// and dispatches a run via the runtime — PatterStage owns the timer, the agent
// does NOT (no Hermes jobs.json). Restart-safe: due work is recomputed from
// next_run_at, never an in-memory timer.
// ═══════════════════════════════════════════════════════════════

import { clampLimit, SCHEDULE_LIST_BOUNDS } from "@/lib/list-bounds";
import { getDb, inTransaction, uuid, now } from "./db";
import { buildUpdate } from "./db/build-update";

export type CatchUpPolicy = "fire_once" | "skip";

/**
 * What a schedule row fires.
 *
 * Every row was a mission until T-0107. Native Windows has no crontab, so the
 * Scripts page's Schedule button had nowhere to write; a 'script' row lets
 * PatterStage's own tick carry a host script instead (decision 10).
 */
export type ScheduleKind = "mission" | "script";

export interface ScheduleRecord {
  id: string;
  kind: ScheduleKind;
  missionId: string | null;
  /** The script this row runs, when `kind` is "script". Null otherwise. */
  scriptName: string | null;
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
  kind: string;
  mission_id: string | null;
  script_name: string | null;
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
    // A row written before 041 has no kind; it is a mission, which is what
    // every row was.
    kind: (row.kind as ScheduleKind) ?? "mission",
    missionId: row.mission_id,
    scriptName: row.script_name ?? null,
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
  kind?: ScheduleKind;
  missionId?: string | null;
  scriptName?: string | null;
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
    getDb()
      .prepare(
        `INSERT INTO schedules
           (id, kind, mission_id, script_name, name, schedule, schedule_display, enabled,
            catch_up_policy, repeat_times, repeat_done, profile_name, next_run_at,
            created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.kind ?? "mission",
        input.missionId ?? null,
        input.scriptName ?? null,
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
  const row = getDb().prepare("SELECT * FROM schedules WHERE id = ?").get(id) as ScheduleRow | undefined;
  return rowToSchedule(row);
}

export function listSchedules(opts?: { limit?: number }): ScheduleRecord[] {
  const rows = getDb()
    .prepare("SELECT * FROM schedules ORDER BY created_at DESC LIMIT ?")
    .all(clampLimit(opts?.limit, SCHEDULE_LIST_BOUNDS)) as ScheduleRow[];
  return rows.map(rowToSchedule).filter((s): s is ScheduleRecord => s !== null);
}

/**
 * Every PatterStage-owned SCRIPT schedule, newest first.
 *
 * The Scripts page merges these with the host crontab so a row can say which
 * of the two it is running on; the host wins where both exist.
 */
export function listScriptSchedules(): ScheduleRecord[] {
  const rows = getDb()
    .prepare("SELECT * FROM schedules WHERE kind = 'script' ORDER BY created_at DESC")
    .all() as ScheduleRow[];
  return rows.map(rowToSchedule).filter((s): s is ScheduleRecord => s !== null);
}

export function getScheduleForMission(missionId: string): ScheduleRecord | null {
  const row = getDb()
    .prepare("SELECT * FROM schedules WHERE mission_id = ? ORDER BY created_at DESC LIMIT 1")
    .get(missionId) as ScheduleRow | undefined;
  return rowToSchedule(row);
}

/**
 * Latest schedule per mission, for the board's one-query-per-page read.
 *
 * The board shows a schedule badge per row, and asking per row is the same
 * N+1 the run reader beside it was written to avoid (T-0104, D68).
 */
export function listSchedulesForMissions(missionIds: string[]): Map<string, ScheduleRecord> {
  const out = new Map<string, ScheduleRecord>();
  // `WHERE mission_id IN ()` is a syntax error, and an empty page has nothing
  // to ask about.
  if (missionIds.length === 0) return out;
  const placeholders = missionIds.map(() => "?").join(",");
  const rows = getDb()
    .prepare(`SELECT * FROM schedules WHERE mission_id IN (${placeholders}) ORDER BY created_at ASC`)
    .all(...missionIds) as ScheduleRow[];
  for (const row of rows) {
    const rec = rowToSchedule(row);
    // Ascending order means the newest row is written last and therefore wins,
    // which is what getScheduleForMission's DESC LIMIT 1 picks.
    if (rec?.missionId) out.set(rec.missionId, rec);
  }
  return out;
}

/** Enabled schedules whose next_run_at is due at or before `asOf` (ISO). */
export function getDueSchedules(asOf: string): ScheduleRecord[] {
  const rows = getDb()
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
    getDb().prepare(`UPDATE schedules SET ${sql} WHERE id = ?`).run(...values, id);
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
    getDb().prepare(`UPDATE schedules SET ${sql} WHERE id = ?`).run(...values, id);
  });
  return getSchedule(id);
}

export function deleteSchedule(id: string): boolean {
  const result = getDb().prepare("DELETE FROM schedules WHERE id = ?").run(id);
  return result.changes > 0;
}

/**
 * Remove every schedule linked to a mission. Called when a mission is deleted so
 * the scheduler tick never tries to dispatch a removed mission. Returns the
 * number of schedules deleted.
 */
export function deleteSchedulesForMission(missionId: string): number {
  const result = getDb().prepare("DELETE FROM schedules WHERE mission_id = ?").run(missionId);
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
    getDb().prepare(`UPDATE schedules SET ${sql} WHERE id = ?`).run(...values, id);
  });
  return getSchedule(id);
}
