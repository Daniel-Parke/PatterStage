// ═══════════════════════════════════════════════════════════════
// session-repository.ts — Unified session registry (CRUD)
//
// Control Hub is the source of truth for ALL agent sessions.
// Hermes session files on disk are synced into this table on every
// sessions API call. Agent-native sessions (mission dispatch, cron)
// are written here directly.
//
// This module is the pure CRUD half of the registry. The Hermes
// state.db sync + orphan-sweep machinery lives in `./session-sync`
// (listSessions pulls in `syncHermesSessionsToDb` for the optional
// `syncIfActive` one-shot).
//
// Schema: src/lib/db/migrations/009_sessions.sql
// ═══════════════════════════════════════════════════════════════

import { db, uuid, now } from "./db";
import { syncHermesSessionsToDb } from "./session-sync";

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
  /**
   * If true, triggers a one-shot sync from Hermes' state.db before returning.
   * Use this on the sessions list/detail pages so that the currently-active
   * session (which may have been updated since the periodic 15s sync cycle
   * last ran) shows a fresh `messageCount`, `title`, and `status`.
   *
   * Default false: callers that don't need the active session's live data
   * (e.g. bulk exports) skip the extra state.db read.
   */
  syncIfActive?: boolean;
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

/**
 * Close the active session row(s) attached to a mission.
 *
 * Mission dispatch pre-registers a `sessions` row with `status: "active"` before
 * spawning the Hermes process. When the mission finishes, the on-disk
 * `<id>.status.json` carries the terminal state, but the dispatcher never
 * gets a callback to write the session row. This helper is the single
 * bridge: it finds the active session for the mission and stamps the
 * terminal fields (status, ended_at, exit_code, error) onto it.
 *
 * - Picks the most recently-started active session (recurring missions
 *   produce one row per run; the latest is the one that just finished).
 * - Idempotent: if no active session exists, returns null silently.
 * - Returns the closed session id, or null when nothing was changed.
 *
 * Used by:
 *   - `MissionSync` happy path (status.json says successful/failed)
 *   - `MissionSync` orphan path (process died without writing status.json)
 *   - Admin backfill endpoint (`/api/admin/backfill-session-status`)
 *   - The recurring orphan-sweep in `syncHermesSessionsToDb`
 */
export function closeSessionForMission(
  missionId: string,
  updates: {
    status: SessionStatus;
    endedAt: string;
    exitCode: number | null;
    error: string | null;
  },
): string | null {
  const database = db();
  const row = database
    .prepare(
      `SELECT id FROM sessions
       WHERE mission_id = ? AND status = 'active'
       ORDER BY started_at DESC
       LIMIT 1`,
    )
    .get(missionId) as { id: string } | undefined;
  if (!row) return null;
  updateSession(row.id, {
    status: updates.status,
    endedAt: updates.endedAt,
    exitCode: updates.exitCode,
    error: updates.error,
  });
  return row.id;
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
  const { agentType, source, missionId, limit = 50, offset = 0, syncIfActive = false } = opts;

  // Optional one-shot sync from Hermes' state.db. Catches the currently-active
  // session before the periodic 15s sync cycle would have updated it. Wrapped
  // in try/catch because a failed sync must NEVER block the list response —
  // the user can still see whatever the last sync captured. The sync pipeline
  // itself lives in ./session-sync.
  if (syncIfActive) {
    try {
      syncHermesSessionsToDb();
    } catch (e) {
      console.warn("[listSessions] syncIfActive sync failed, returning stale data:", e);
    }
  }

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
 * Used in both session-sync.ts (sync path) and sessions/[id]/route.ts (state.db path).
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
