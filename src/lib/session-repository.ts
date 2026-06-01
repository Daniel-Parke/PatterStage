// ═══════════════════════════════════════════════════════════════
// session-repository.ts — Unified session registry
//
// Control Hub is the source of truth for ALL agent sessions.
// Hermes session files on disk are synced into this table on every
// sessions API call. Agent-native sessions (mission dispatch, cron)
// are written here directly.
//
// Schema: src/lib/db/migrations/009_sessions.sql
// ═══════════════════════════════════════════════════════════════

import { db, uuid, now } from "./db";
import Database from "better-sqlite3";
import { getActiveHermesPaths } from "./hermes-agent-runtime";
import { existsSync } from "fs";
import { join } from "path";
import { loadCronJobsMap } from "./session-title-server";

// ── Types ───────────────────────────────────────────────────

export type AgentType = "hermes";
export type SessionSource = "cli" | "cron" | "mission" | "api";
export type SessionStatus = "active" | "completed" | "failed";

export interface SessionRecord {
  id: string;
  agentType: AgentType;
  source: SessionSource;
  missionId: string | null;
  profileName: string | null;
  modelId: string | null;
  provider: string | null;
  title: string | null;
  size: number;
  startedAt: string;
  endedAt: string | null;
  status: SessionStatus;
  exitCode: number | null;
  error: string | null;
  /**
   * Number of messages in this session. Populated from the Hermes state.db
   * sync when available; null for sessions written directly by the Control
   * Hub dispatch pipeline (mission/cron rows) where the message count is
   * only known after the agent finishes. Used by the Sessions list to show
   * a "5 msgs" badge so users can tell an empty session from a populated
   * one without clicking through.
   */
  messageCount: number | null;
}

export interface CreateSessionInput {
  agentType?: AgentType;
  source: SessionSource;
  missionId?: string | null;
  profileName?: string | null;
  modelId?: string | null;
  provider?: string | null;
  title?: string | null;
  size?: number;
  startedAt?: string;
  status?: SessionStatus;
}

export interface UpdateSessionInput {
  endedAt?: string | null;
  status?: SessionStatus;
  exitCode?: number | null;
  error?: string | null;
  size?: number;
  title?: string | null;
}

export interface ListSessionsOptions {
  agentType?: AgentType;
  source?: SessionSource;
  missionId?: string | null;
  limit?: number;
  offset?: number;
}

// ── Row shape (internal) ─────────────────────────────────────

interface SessionRow {
  id: string;
  agent_type: string;
  source: string;
  mission_id: string | null;
  profile_name: string | null;
  model_id: string | null;
  provider: string | null;
  title: string | null;
  size: number;
  started_at: string;
  ended_at: string | null;
  status: string;
  exit_code: number | null;
  error: string | null;
  message_count: number | null;
}

function rowToSession(row: SessionRow | undefined): SessionRecord | null {
  if (!row) return null;
  return {
    id: row.id,
    agentType: row.agent_type as AgentType,
    source: row.source as SessionSource,
    missionId: row.mission_id ?? null,
    profileName: row.profile_name ?? null,
    modelId: row.model_id ?? null,
    provider: row.provider ?? null,
    title: row.title ?? null,
    size: row.size,
    startedAt: row.started_at,
    endedAt: row.ended_at ?? null,
    status: row.status as SessionStatus,
    exitCode: row.exit_code ?? null,
    error: row.error ?? null,
    messageCount: row.message_count ?? null,
  };
}

// ── CRUD ───────────────────────────────────────────────────

export function createSession(input: CreateSessionInput): SessionRecord {
  const id = uuid();
  const startedAt = input.startedAt ?? now();
  const database = db();
  database.prepare(/* sql */ `
    INSERT INTO sessions (
      id, agent_type, source, mission_id, profile_name,
      model_id, provider, title, size, started_at, status
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?
    )
  `).run(
    id,
    input.agentType ?? "hermes",
    input.source,
    input.missionId ?? null,
    input.profileName ?? null,
    input.modelId ?? null,
    input.provider ?? null,
    input.title ?? null,
    input.size ?? 0,
    startedAt,
    input.status ?? "active",
  );
  return getSession(id)!;
}

export function updateSession(id: string, updates: UpdateSessionInput): SessionRecord | null {
  const sets: string[] = [];
  const vals: (string | number | null)[] = [];

  if (updates.endedAt !== undefined) {
    sets.push("ended_at = ?");
    vals.push(updates.endedAt ?? null);
  }
  if (updates.status !== undefined) {
    sets.push("status = ?");
    vals.push(updates.status);
  }
  if (updates.exitCode !== undefined) {
    sets.push("exit_code = ?");
    vals.push(updates.exitCode ?? null);
  }
  if (updates.error !== undefined) {
    sets.push("error = ?");
    vals.push(updates.error ?? null);
  }
  if (updates.size !== undefined) {
    sets.push("size = ?");
    vals.push(updates.size);
  }
  if (updates.title !== undefined) {
    sets.push("title = ?");
    vals.push(updates.title ?? null);
  }

  if (sets.length === 0) return getSession(id);

  vals.push(id);
  db().prepare(`UPDATE sessions SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  return getSession(id);
}

export function getSession(id: string): SessionRecord | null {
  const row = db().prepare("SELECT * FROM sessions WHERE id = ?").get(id) as
    | SessionRow
    | undefined;
  return rowToSession(row);
}

export function listSessions(opts: ListSessionsOptions = {}): {
  sessions: SessionRecord[];
  total: number;
} {
  const { agentType, source, missionId, limit = 50, offset = 0 } = opts;
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (agentType) {
    conditions.push("agent_type = ?");
    params.push(agentType);
  }
  if (source) {
    conditions.push("source = ?");
    params.push(source);
  }
  if (missionId !== undefined) {
    conditions.push(missionId === null ? "mission_id IS NULL" : "mission_id = ?");
    if (missionId !== null) params.push(missionId);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const database = db();
  const total = (
    database
      .prepare(`SELECT COUNT(*) as c FROM sessions ${where}`)
      .get(...params) as { c: number }
  ).c;

  const rows = database
    .prepare(
      `SELECT * FROM sessions ${where} ORDER BY started_at DESC LIMIT ? OFFSET ?`,
    )
    .all(...params, limit, offset) as SessionRow[];

  return { sessions: rows.map(rowToSession).filter(Boolean) as SessionRecord[], total };
}

// ── Shared helpers ─────────────────────────────────────────────

/**
 * Estimate session file size based on message and API call counts.
 * Used in both session-repository.ts (sync path) and sessions/[id]/route.ts (state.db path).
 * Formula: message_count * 200 + api_call_count * 50, floored at a minimum.
 * The minimum is per-caller — default 0 for bulk sync, caller provides for individual display.
 */
export function estimateSessionSize(
  messageCount: number | null,
  apiCallCount: number | null,
  minSize = 0,
): number {
  return Math.max(
    (messageCount ?? 0) * 200 + (apiCallCount ?? 0) * 50,
    minSize,
  );
}

// ── Hermes state.db sync ──────────────────────────────────────

interface HermesSessionRow {
  id: string;
  source: string;
  model: string;
  title: string | null;
  started_at: number;
  ended_at: number | null;
  end_reason: string | null;
  message_count: number | null;
  api_call_count: number | null;
}

function hermesStatusFromEndReason(
  end_reason: string | null,
): { status: SessionStatus; exitCode: number | null } {
  if (!end_reason) return { status: "active", exitCode: null };
  switch (end_reason) {
    case "stop":
    case "token_limit":
    case "max_iterations":
      return { status: "completed", exitCode: 0 };
    case "timeout":
    case "interrupt":
      return { status: "completed", exitCode: 143 };
    case "error":
      return { status: "failed", exitCode: 1 };
    default:
      return { status: "completed", exitCode: null };
  }
}

function readHermesSessionsFromStateDb(): HermesSessionRow[] {
  const root = getActiveHermesPaths().root;
  const stateDbPath = join(root, "state.db");
  if (!existsSync(stateDbPath)) return [];

  let hermesDb: Database.Database | null = null;
  try {
    hermesDb = new Database(stateDbPath, { readonly: true });

    const tables = hermesDb
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'")
      .all();
    if (tables.length === 0) {
      hermesDb.close();
      hermesDb = null;
      return [];
    }

    const rows = hermesDb
      .prepare(
        // LIMIT bounds the sync cost on a giant state.db. The /api/sessions
        // route paginates 50 per page anyway, and 10K is a generous ceiling
        // for any UI use case. The full set can still be inspected via the
        // Hermes CLI (`hermes sessions list`). See session-repository.ts
        // header for the FTS-bloat rationale.
        `SELECT id, source, model, title, started_at, ended_at, end_reason, message_count, api_call_count
         FROM sessions ORDER BY started_at DESC LIMIT 10000`,
      )
      .all() as HermesSessionRow[];
    hermesDb.close();
    hermesDb = null;

    return rows;
  } catch {
    return [];
  } finally {
    if (hermesDb) {
      try { hermesDb.close(); } catch { /* already closed or never fully opened */ }
    }
  }
}

/**
 * Build a set of all mission IDs from Control Hub's missions table.
 * Includes soft-deleted missions — the FK constraint only checks id existence,
 * not deleted_at. Used to filter session mission_ids so we never insert
 * a mission_id that would violate the FK.
 */
function buildValidMissionIdSet(): Set<string> {
  try {
    const rows = db()
      .prepare("SELECT id FROM missions")
      .all() as Array<{ id: string }>;
    return new Set(rows.map((r) => r.id));
  } catch {
    return new Set();
  }
}

/**
 * Build a map of Hermes job ID -> Control Hub mission UUID.
 *
 * Correct join path:
 *   Hermes job ID (e.g. "9514116b5b0d")
 *     -> cron_jobs.hermes_job_id = job ID
 *     -> cron_jobs.id = cron_job UUID
 *     -> missions.cron_job_id = cron_jobs.id (FK to cron_jobs)
 *     -> missions.id = mission UUID
 */
function buildMissionIdByJobId(): Map<string, string> {
  const missionIdByJobId = new Map<string, string>();
  try {
    const rows = db()
      .prepare(`
        SELECT m.id AS mission_id, c.hermes_job_id
        FROM missions m
        JOIN cron_jobs c ON c.id = m.cron_job_id
        WHERE c.hermes_job_id IS NOT NULL AND c.hermes_job_id != ''
      `)
      .all() as Array<{ mission_id: string; hermes_job_id: string }>;
    for (const row of rows) {
      missionIdByJobId.set(row.hermes_job_id, row.mission_id);
    }
  } catch {
    // table structure may differ — non-fatal
  }
  return missionIdByJobId;
}

/**
 * Sync Hermes sessions into the sessions table.
 *
 * Reads session metadata from Hermes's state.db (v0.14+).
 * Upserts so Control Hub has a unified view of all agent activity.
 *
 * For cron sessions, derives mission_id by matching the embedded
 * job ID in the session title against cron_jobs.hermes_job_id,
 * then resolving to missions.id via the missions.cron_job_id FK.
 *
 * Completed sessions in Hermes are updated to "completed"/"failed"
 * status here — their end state is always driven by Hermes.
 */

// Tracks the most recent orphan-close count so the periodic log can
// suppress the steady-state churn and only fire when the count changes
// meaningfully. Reset to null to log a fresh first-occurrence value.
// See audit Issue #3 (dogfood-output/report.md).
let lastOrphanCloseCount: number | null = null;

/**
 * Idempotent runtime check that the sessions.message_count column exists.
 *
 * The 006_sessions_message_count.sql migration adds it for fresh installs;
 * existing DBs that pre-date the migration are upgraded lazily the first
 * time a sync runs. Same pattern as profiles-tools-parity-ensure.
 */
function ensureMessageCountColumn(database: Database.Database): void {
  try {
    const col = database
      .prepare("SELECT 1 FROM pragma_table_info('sessions') WHERE name='message_count'")
      .get();
    if (!col) {
      database.exec("ALTER TABLE sessions ADD COLUMN message_count INTEGER");
    }
  } catch {
    // Non-fatal: the column will simply remain unavailable and the upsert
    // below will skip message_count via COALESCE handling.
  }
}

export function syncHermesSessionsToDb(): { synced: number; skipped: number } {
  const hermesSessions = readHermesSessionsFromStateDb();
  const missionIdByJobId = buildMissionIdByJobId();
  const validMissionIds = buildValidMissionIdSet();
  const database = db();
  ensureMessageCountColumn(database);
  const cronJobsById = loadCronJobsMap();

  // ── Step 1: Clean up stale mission_id references ─────────────
  // NULL out mission_ids that point to soft-deleted or missing missions
  // to prevent FK violations on subsequent upserts.
  try {
    database.prepare(/* sql */ `
      UPDATE sessions
      SET mission_id = NULL
      WHERE source = 'cron'
        AND mission_id IS NOT NULL
        AND mission_id NOT IN (SELECT id FROM missions WHERE deleted_at IS NULL)
    `).run();
  } catch {
    // non-fatal — the individual try/catch below will handle any remaining FK issues
  }

  const upsert = database.prepare(/* sql */ `
    INSERT INTO sessions (
      id, agent_type, source, mission_id,
      model_id, provider, title, size, started_at, ended_at,
      status, exit_code, message_count
    ) VALUES (
      ?, 'hermes', ?, ?,
      ?, NULL, ?, ?, ?, ?,
      ?, ?, ?
    )
    ON CONFLICT(id) DO UPDATE SET
      source        = excluded.source,
      title         = excluded.title,
      model_id      = COALESCE(excluded.model_id, model_id),
      mission_id    = COALESCE(excluded.mission_id, mission_id),
      size          = excluded.size,
      started_at    = excluded.started_at,
      ended_at      = COALESCE(excluded.ended_at, ended_at),
      status        = excluded.status,
      exit_code     = COALESCE(excluded.exit_code, exit_code),
      message_count = COALESCE(excluded.message_count, message_count)
  `);

  const tx = database.transaction(() => {
    let synced = 0;
    let skipped = 0;
    for (const row of hermesSessions) {
      const startedAt = new Date(row.started_at * 1000).toISOString();
      const endedAt = row.ended_at
        ? new Date(row.ended_at * 1000).toISOString()
        : null;
      const { status, exitCode } = hermesStatusFromEndReason(row.end_reason);
      const size = estimateSessionSize(row.message_count, row.api_call_count);

      let title = row.title ?? row.id;
      let missionId: string | null = null;

      if (row.source === "cron") {
        // cron session id: cron_<jobid>_<date>_<time>
        const parts = row.id.replace(/^cron_/, "").split("_");
        if (parts.length >= 3) {
          const jobId = parts[0];
          // Prefer the cron job's human name from jobs.json over the raw jobId.
          // Falls back to the jobId prefix if the job isn't in jobs.json
          // (e.g. legacy entries from before the recurring mission was registered).
          const jobName = cronJobsById.get(jobId)?.name;
          const displayJob = jobName ? jobName : jobId.slice(0, 8);
          title = `Cron: ${displayJob} — ${parts.slice(1).join(" ")}`;
          const candidateMissionId = missionIdByJobId.get(jobId) ?? null;
          // Only set mission_id if it exists in missions table (avoids FK violations)
          missionId =
            candidateMissionId && validMissionIds.has(candidateMissionId)
              ? candidateMissionId
              : null;
        }
      } else if (row.source === "api_server") {
        // api_server sessions mapped to api source
      }

      try {
        upsert.run(
          row.id,
          row.source === "api_server" ? "api" : row.source,
          missionId,
          row.model ?? null,
          title,
          size,
          startedAt,
          endedAt,
          status,
          exitCode,
          row.message_count ?? null,
        );
        synced++;
      } catch {
        // FK violation or other transient error — skip this session
        // so it doesn't kill the entire transaction
        skipped++;
      }
    }
    return { synced, skipped };
  });

  const result = tx();
  if (result.skipped > 0) {
    console.warn(`[syncHermesSessionsToDb] skipped ${result.skipped} sessions due to FK/constraint errors`);
  }

  // ── Step 3: Close orphaned active sessions ──────────────────
  // The Hermes Gateway API doesn't set end_reason on completion,
  // so sessions end up permanently stuck as "active". Close any
  // session that has actual content, no end state, and is older
  // than 5 minutes (safely past any in-progress window).
  //
  // The 15s sync cycle re-runs this UPDATE on every tick, so without
  // the suppression below the log line fires ~4×/min with a count
  // that hovers between the same values forever (gateway keeps
  // re-inserting them as active on the next cycle's upsert). That's
  // not actionable signal — keep the first-occurrence log for the
  // diagnostic value and stay quiet for the steady-state churn.
  // Audit reference: dogfood-output/report.md Issue #3.
  try {
    const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { changes } = database
      .prepare(/* sql */ `
        UPDATE sessions
        SET status = 'completed',
            ended_at = COALESCE(ended_at, started_at)
        WHERE status = 'active'
          AND source IN ('api', 'cli')
          AND size > 0
          AND started_at < ?
      `)
      .run(cutoff);
    if (changes > 0 && (lastOrphanCloseCount === null || Math.abs(changes - lastOrphanCloseCount) >= 100)) {
      console.log(`[syncHermesSessionsToDb] closed ${changes} orphaned active sessions`);
      lastOrphanCloseCount = changes;
    } else if (changes === 0 && lastOrphanCloseCount !== null && lastOrphanCloseCount > 0) {
      // The queue has drained — log a final "0" so the operator knows
      // the steady-state was reached, then reset.
      console.log(`[syncHermesSessionsToDb] orphan session queue drained (was ${lastOrphanCloseCount})`);
      lastOrphanCloseCount = null;
    } else if (changes > 0) {
      // Suppressed — but keep the latest count so we log when it
      // changes by >=100 (a real shift worth noting).
      lastOrphanCloseCount = changes;
    }
  } catch {
    // non-fatal cleanup
  }

  return { synced: result.synced, skipped: result.skipped };
}
