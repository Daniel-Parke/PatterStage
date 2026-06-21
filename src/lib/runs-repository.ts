// ═══════════════════════════════════════════════════════════════
// runs-repository.ts — CRUD for agent runs (replaces pid/status-file IPC)
//
// A `run` row tracks one agent execution from submit → terminal. `id` is the
// PatterStage-owned id (also the Idempotency-Key sent to the backend); the
// backend's own id is stored in `run_id`. Run state is reconciled by polling
// the runtime (see orchestration/RunSync), never by reading status.json files.
// ═══════════════════════════════════════════════════════════════

import { db, inTransaction, now } from "./db";
import { buildUpdate } from "./db/build-update";
import type { RunStatus, RunUsage } from "@/lib/runtime/types";

export interface RunRecord {
  id: string;
  runId: string | null;
  missionId: string | null;
  scheduleId: string | null;
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

function parseUsage(raw: string | null): RunUsage | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as Partial<RunUsage>;
    return {
      inputTokens: Number(o.inputTokens ?? 0),
      outputTokens: Number(o.outputTokens ?? 0),
      totalTokens: Number(o.totalTokens ?? 0),
    };
  } catch {
    return null;
  }
}

function rowToRun(row: RunRow | undefined): RunRecord | null {
  if (!row) return null;
  return {
    id: row.id,
    runId: row.run_id,
    missionId: row.mission_id,
    scheduleId: row.schedule_id,
    profileName: row.profile_name,
    sessionId: row.session_id,
    status: row.status as RunStatus,
    output: row.output,
    usage: parseUsage(row.usage_json),
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
  profileName?: string | null;
}

/**
 * Insert a 'started' run row. Used transactionally by the scheduler tick so a
 * duplicate tick that re-inserts the same id fails the PK guard instead of
 * double-dispatching. Returns false when the id already exists.
 */
export function createRun(input: CreateRunInput): boolean {
  const ts = now();
  const result = db()
    .prepare(
      `INSERT OR IGNORE INTO runs
         (id, mission_id, schedule_id, profile_name, status, submitted_at, updated_at)
       VALUES (?, ?, ?, ?, 'started', ?, ?)`,
    )
    .run(input.id, input.missionId ?? null, input.scheduleId ?? null, input.profileName ?? null, ts, ts);
  return result.changes > 0;
}

// ── Read ─────────────────────────────────────────────────────

export function getRun(id: string): RunRecord | null {
  const row = db().prepare("SELECT * FROM runs WHERE id = ?").get(id) as RunRow | undefined;
  return rowToRun(row);
}

export function getLatestRunForMission(missionId: string): RunRecord | null {
  const row = db()
    .prepare("SELECT * FROM runs WHERE mission_id = ? ORDER BY submitted_at DESC LIMIT 1")
    .get(missionId) as RunRow | undefined;
  return rowToRun(row);
}

/** All non-terminal runs (the reconcile loop polls these). */
export function listActiveRuns(): RunRecord[] {
  const rows = db()
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
    db().prepare(`UPDATE runs SET ${sql} WHERE id = ?`).run(...values, id);
  });
  return getRun(id);
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
    db().prepare(`UPDATE runs SET ${sql} WHERE id = ?`).run(...values, id);
  });
  return getRun(id);
}
