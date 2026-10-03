// ═══════════════════════════════════════════════════════════════
// runs-repository.ts — CRUD for agent runs (replaces pid/status-file IPC)
//
// A `run` row tracks one agent execution from submit → terminal. `id` is the
// PatterStage-owned id (also the Idempotency-Key sent to the backend); the
// backend's own id is stored in `run_id`. Run state is reconciled by polling
// the runtime (see orchestration/RunSync), never by reading status.json files.
// ═══════════════════════════════════════════════════════════════

import { getDb, inTransaction, now, uuid } from "../db/index";
import { logApiError } from "../api/api-logger";
import type { SpendSource } from "../spend/spend-law";
import { buildUpdate } from "../db/build-update";
import type { RunStatus, RunUsage } from "@/lib/runtime/types";
import { parseStoredUsage } from "./parse-stored-usage";

export interface RunRecord {
  id: string;
  runId: string | null;
  missionId: string | null;
  scheduleId: string | null;
  /** Set when this run executes a Composer stage (graph orchestrator), else null. */
  composerNodeRunId: string | null;
  profileName: string | null;
  sessionId: string | null;
  status: RunStatus;
  output: string | null;
  usage: RunUsage | null;
  error: string | null;
  submittedAt: string;
  completedAt: string | null;
  updatedAt: string;
}

interface RunRow {
  id: string;
  run_id: string | null;
  mission_id: string | null;
  schedule_id: string | null;
  composer_node_run_id: string | null;
  profile_name: string | null;
  session_id: string | null;
  status: string;
  output: string | null;
  usage_json: string | null;
  error: string | null;
  submitted_at: string;
  completed_at: string | null;
  updated_at: string;
}

function rowToRun(row: RunRow | undefined): RunRecord | null {
  if (!row) return null;
  return {
    id: row.id,
    runId: row.run_id,
    missionId: row.mission_id,
    scheduleId: row.schedule_id,
    composerNodeRunId: row.composer_node_run_id,
    profileName: row.profile_name,
    sessionId: row.session_id,
    status: row.status as RunStatus,
    output: row.output,
    usage: parseStoredUsage(row.usage_json),
    error: row.error,
    submittedAt: row.submitted_at,
    completedAt: row.completed_at,
    updatedAt: row.updated_at,
  };
}

// ── Create ───────────────────────────────────────────────────

export interface CreateRunInput {
  /** PatterStage-owned run id (also used as the Idempotency-Key). */
  id: string;
  missionId?: string | null;
  scheduleId?: string | null;
  composerNodeRunId?: string | null;
  profileName?: string | null;
  /** Which feature is spending. Derived from the composer link when omitted. */
  spendSource?: SpendSource;
}

/**
 * Insert a 'started' run row. Used transactionally by the scheduler tick so a
 * duplicate tick that re-inserts the same id fails the PK guard instead of
 * double-dispatching. Returns false when the id already exists.
 */
export function createRun(input: CreateRunInput): boolean {
  const ts = now();
  const result = getDb()
    .prepare(
      `INSERT OR IGNORE INTO runs
         (id, mission_id, schedule_id, composer_node_run_id, profile_name, spend_source, status, submitted_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'started', ?, ?)`,
    )
    .run(
      input.id,
      input.missionId ?? null,
      input.scheduleId ?? null,
      input.composerNodeRunId ?? null,
      input.profileName ?? null,
      input.spendSource ?? (input.composerNodeRunId ? "composer" : "agent"),
      ts,
      ts,
    );
  return result.changes > 0;
}

/**
 * Record what a direct LLM call cost, as a completed run row.
 *
 * Story Weaver drives callLLM itself: no mission, no schedule, no Composer
 * node, and so no runs row and no spend (T-0108, D87). This is that row.
 * Best-effort by contract, because bookkeeping must never fail the chapter the
 * operator is waiting for: it swallows and logs rather than throwing.
 */
export function createSpendRun(input: {
  source: SpendSource;
  storyId?: string | null;
  usage: RunUsage;
}): void {
  try {
    const ts = now();
    getDb()
      .prepare(
        `INSERT INTO runs
           (id, story_id, spend_source, status, usage_json, submitted_at, completed_at, updated_at)
         VALUES (?, ?, ?, 'completed', ?, ?, ?, ?)`,
      )
      .run(uuid(), input.storyId ?? null, input.source, JSON.stringify(input.usage), ts, ts, ts);
  } catch (err) {
    logApiError("spend.createSpendRun", input.source, err);
  }
}

// ── Read ─────────────────────────────────────────────────────

export function getRun(id: string): RunRecord | null {
  const row = getDb().prepare("SELECT * FROM runs WHERE id = ?").get(id) as RunRow | undefined;
  return rowToRun(row);
}

export function getLatestRunForMission(missionId: string): RunRecord | null {
  const row = getDb()
    .prepare("SELECT * FROM runs WHERE mission_id = ? ORDER BY submitted_at DESC, rowid DESC LIMIT 1")
    .get(missionId) as RunRow | undefined;
  return rowToRun(row);
}

/** All active claims for a mission, including rows left by older dispatchers. */
export function listActiveRunsForMission(missionId: string): RunRecord[] {
  const rows = getDb().prepare(
    "SELECT * FROM runs WHERE mission_id = ? AND status = 'started' ORDER BY rowid DESC",
  ).all(missionId) as RunRow[];
  return rows.map(rowToRun).filter((run): run is RunRecord => run !== null);
}

/** Backend IDs still needing a best-effort remote stop after local cancellation. */
export function listCancelledBackendRunsForMission(missionId: string): RunRecord[] {
  const rows = getDb().prepare(
    "SELECT * FROM runs WHERE mission_id = ? AND status = 'cancelled' AND run_id IS NOT NULL ORDER BY rowid DESC",
  ).all(missionId) as RunRow[];
  return rows.map(rowToRun).filter((run): run is RunRecord => run !== null);
}

/**
 * The latest run for each of the given missions, keyed by mission id.
 *
 * The mission board needs the run anchor for every row it draws, and the
 * obvious `getLatestRunForMission` in a loop is one query per mission on a
 * 15-second poll. This is the same answer in one query. An empty id list
 * short-circuits rather than building `IN ()`, which SQLite rejects.
 */
export function listLatestRunsForMissions(missionIds: string[]): Map<string, RunRecord> {
  const byMission = new Map<string, RunRecord>();
  if (missionIds.length === 0) return byMission;
  const placeholders = missionIds.map(() => "?").join(", ");
  const rows = getDb()
    .prepare(
      `SELECT r.* FROM runs r
        WHERE r.mission_id IN (${placeholders})
          AND r.rowid = (
            SELECT r2.rowid FROM runs r2 WHERE r2.mission_id = r.mission_id
            ORDER BY r2.submitted_at DESC, r2.rowid DESC LIMIT 1
          )`,
    )
    .all(...missionIds) as RunRow[];
  for (const row of rows) {
    const run = rowToRun(row);
    // The same timestamp and rowid order as getLatestRunForMission keeps the
    // board and detail panel on the same claim when two runs share a second.
    if (run?.missionId) byMission.set(run.missionId, run);
  }
  return byMission;
}

/** All non-terminal runs (the reconcile loop polls these). */
export function listActiveRuns(): RunRecord[] {
  const rows = getDb()
    .prepare("SELECT * FROM runs WHERE status = 'started' ORDER BY submitted_at ASC")
    .all() as RunRow[];
  return rows.map(rowToRun).filter((r): r is RunRecord => r !== null);
}

// ── Update ───────────────────────────────────────────────────

/** Record the backend run id + initial session once submitRun returns. */
export function attachBackendRun(
  id: string,
  fields: { runId: string; sessionId?: string | null; status?: RunStatus },
): RunRecord | null {
  const { sql, values } = buildUpdate(
    {
      run_id: fields.runId,
      session_id: fields.sessionId ?? undefined,
      status: fields.status ?? undefined,
    },
    { now: now() },
  );
  inTransaction(() => {
    getDb().prepare(`UPDATE runs SET ${sql} WHERE id = ?`).run(...values, id);
  });
  return getRun(id);
}

function activeMissionClaim(database: ReturnType<typeof getDb>, id: string, missionId: string): boolean {
  return Boolean(database.prepare(
    `SELECT 1 FROM runs r JOIN missions m ON m.id = r.mission_id
     WHERE r.id = ? AND r.mission_id = ? AND r.status = 'started'
       AND m.status = 'dispatched'
       AND r.id = (SELECT newest.id FROM runs newest
                   WHERE newest.mission_id = ? ORDER BY newest.rowid DESC LIMIT 1)`,
  ).get(id, missionId, missionId));
}

/**
 * Commit a gateway acknowledgement only while its mission and newest run
 * still belong to the same active claim. A cancellation committed during the
 * network await wins instead of being rewritten as dispatched.
 */
export function acknowledgeMissionSubmission(
  id: string,
  missionId: string,
  fields: { runId: string; sessionId: string; status: RunStatus },
): boolean {
  const database = getDb();
  return database.transaction(() => {
    if (!activeMissionClaim(database, id, missionId)) return false;
    const ts = now();
    database.prepare(
      `UPDATE runs SET run_id = ?, session_id = ?, status = 'started', updated_at = ?
       WHERE id = ? AND status = 'started'`,
    ).run(fields.runId, fields.sessionId, ts, id);
    database.prepare(
      `UPDATE missions SET session_id = ?, result = NULL, updated_at = ?
       WHERE id = ? AND status = 'dispatched'`,
    ).run(fields.sessionId, ts, missionId);
    return true;
  }).immediate();
}

/** A timed-out submit remains held only while this claim is still active. */
export function markMissionSubmissionUnconfirmedIfActive(id: string, missionId: string, message: string): boolean {
  const database = getDb();
  return database.transaction(() => {
    if (!activeMissionClaim(database, id, missionId)) return false;
    database.prepare(
      "UPDATE missions SET result = ?, updated_at = ? WHERE id = ? AND status = 'dispatched'",
    ).run(message, now(), missionId);
    return true;
  }).immediate();
}

/** A gateway rejection has no authority after cancellation or a newer run. */
export function failMissionSubmissionIfActive(id: string, missionId: string, message: string): boolean {
  const database = getDb();
  return database.transaction(() => {
    if (!activeMissionClaim(database, id, missionId)) return false;
    const ts = now();
    database.prepare(
      `UPDATE runs SET status = 'failed', error = ?, completed_at = ?, updated_at = ?
       WHERE id = ? AND status = 'started'`,
    ).run(message, ts, ts, id);
    database.prepare(
      `UPDATE missions SET status = 'failed', result = ?, updated_at = ?
       WHERE id = ? AND status = 'dispatched'`,
    ).run(message, ts, missionId);
    return true;
  }).immediate();
}

/** Apply a reconciled or terminal state to a run. */
export function updateRun(
  id: string,
  updates: {
    status?: RunStatus;
    sessionId?: string | null;
    output?: string | null;
    usage?: RunUsage | null;
    error?: string | null;
  },
): RunRecord | null {
  const terminal =
    updates.status === "completed" || updates.status === "failed" || updates.status === "cancelled";
  const ts = now();
  const { sql, values } = buildUpdate(
    {
      status: updates.status,
      session_id: updates.sessionId ?? undefined,
      output: updates.output ?? undefined,
      usage_json: updates.usage === undefined ? undefined : updates.usage === null ? null : JSON.stringify(updates.usage),
      error: updates.error ?? undefined,
      completed_at: terminal ? ts : undefined,
    },
    { now: ts },
  );
  inTransaction(() => {
    getDb().prepare(`UPDATE runs SET ${sql} WHERE id = ?`).run(...values, id);
  });
  return getRun(id);
}
