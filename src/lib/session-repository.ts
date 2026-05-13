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
import { getActiveHermesPaths } from "./hermes-agent-runtime";
import { existsSync, readdirSync, statSync } from "fs";
import { join } from "path";

// ── Types ────────────────────────────────────────────────────

export type AgentType = "hermes" | string;
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
  };
}

// ── CRUD ────────────────────────────────────────────────────

/**
 * Insert a new session record. Called by the dispatch pipeline when a mission
 * or cron job starts. Also called by syncHermesSessionsToDb for CLI sessions.
 */
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

/**
 * Update a session record. Called when a mission/cron completes or fails.
 */
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
 * Fetch a single session by id.
 */
export function getSession(id: string): SessionRecord | null {
  const row = db().prepare("SELECT * FROM sessions WHERE id = ?").get(id) as
    | SessionRow
    | undefined;
  return rowToSession(row);
}

/**
 * List sessions with optional filters. Ordered by started_at DESC.
 */
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

// ── Hermes file sync ─────────────────────────────────────────

interface HermesSessionFile {
  filename: string;
  id: string;
  title: string;
  source: SessionSource;
  size: number;
  created: string;
  modified: string;
}

/**
 * Read Hermes's session directory and return lightweight metadata for each file.
 * Does NOT parse the JSON content — only filename patterns + stat().
 */
function scanHermesSessionDir(): HermesSessionFile[] {
  const sessionsPath = getActiveHermesPaths().sessions;
  if (!existsSync(sessionsPath)) return [];

  try {
    return readdirSync(sessionsPath)
      .filter((f) => f.endsWith(".json") || f.endsWith(".jsonl"))
      .map((file) => {
        const fullPath = join(sessionsPath, file);
        const stats = statSync(fullPath);
        const id = file.replace(/\.(json|jsonl)$/, "");
        let title = "";
        let source: SessionSource = "cli";

        if (file.startsWith("session_cron_")) {
          source = "cron";
          const parts = file.replace(/\.(json|jsonl)$/, "").split("_");
          if (parts.length >= 4) {
            title = `Cron: ${parts[2]} — ${parts.slice(3).join(" ")}`;
          }
        } else if (file.startsWith("session_")) {
          source = "cli";
          title = file.replace(/_/g, " ").replace(/\.(json|jsonl)$/, "");
        }

        return {
          filename: file,
          id,
          title: title || file,
          source,
          size: stats.size,
          created: stats.birthtime.toISOString(),
          modified: stats.mtime.toISOString(),
        };
      });
  } catch {
    return [];
  }
}

/**
 * Sync Hermes session files into the sessions table.
 *
 * Strategy: for each file in Hermes's sessions dir, UPSERT into the DB
 * (INSERT OR REPLACE). This means Hermes CLI/cron sessions are tracked in
 * Control Hub's registry alongside mission-born sessions, giving a single
 * unified view.
 *
 * Only hermes sessions with source='cli' or source='cron' are synced.
 * Sessions that have already been upserted are refreshed (title, size, modified).
 * Sessions that no longer exist on disk are NOT deleted from the DB — that would
 * lose the record of completed sessions.
 */
export function syncHermesSessionsToDb(): { synced: number } {
  const files = scanHermesSessionDir();
  const database = db();
  const upsert = database.prepare(/* sql */ `
    INSERT INTO sessions (
      id, agent_type, source, title, size, started_at, status
    ) VALUES (
      ?, 'hermes', ?, ?, ?, ?, 'active'
    )
    ON CONFLICT(id) DO UPDATE SET
      title   = excluded.title,
      size    = excluded.size
  `);

  const tx = database.transaction(() => {
    let count = 0;
    for (const f of files) {
      upsert.run(f.id, f.source, f.title, f.size, f.modified);
      count++;
    }
    return count;
  });

  return { synced: tx() };
}
