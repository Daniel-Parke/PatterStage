// ═══════════════════════════════════════════════════════════════
// session-repository.ts — Unified session registry (CRUD)
//
// PatterStage is the source of truth for ALL agent sessions.
// Hermes session files on disk are synced into this table on every
// sessions API call. Agent-native sessions (mission dispatch, cron)
// are written here directly.
//
// This module is the pure CRUD half of the registry. The sync side
// lives in four siblings: `./session-sync` (the upsert pipeline;
// listSessions pulls in `syncHermesSessionsToDb` for the optional
// `syncIfActive` one-shot), `./hermes-state-sessions` (reads the
// agent's state.db), `./session-mission-links` (session → parent
// mission) and `./session-orphan-sweep` (closes stuck rows).
//
// Schema: src/lib/db/migrations/009_sessions.sql
// ═══════════════════════════════════════════════════════════════

import { getDb, uuid, now } from "../db";
import { syncHermesSessionsToDb } from "./session-sync";
import { API_NOISE_MAX_BYTES, API_NOISE_MAX_DURATION_MS } from "./session-filters";
import { hasSessionMessageCountColumn } from "./session-sync-repository";
import { getActiveFrameworkConfig } from "../frameworks/repository";
import type { FrameworkType } from "../frameworks/types";

// ── Types ───────────────────────────────────────────────────

/**
 * Which agent framework ran a session. This is the framework's registry id, so
 * it is `FrameworkType` rather than a one-member union hardcoding the vendor:
 * `sessions.agent_type` already had a neutral COLUMN name, and the coupling was
 * entirely in core supplying the literal `"hermes"` as its default. The literal
 * now lives only in the frameworks layer, which is the adapter
 * (org/decisions/ADR-0005-product-modules.md).
 */
export type AgentType = FrameworkType;
/** The sources PatterStage has a word for. */
export type KnownSessionSource =
  | "cli"
  | "cron"
  | "mission"
  | "api"
  | "chat"
  | "subagent"
  | "tui";

/**
 * The column is free text and the agent writes whatever it likes into it, so
 * the union is the vocabulary we have words for, not the set of values that
 * can occur. Badging an unrecognised source "CLI" is how a subagent session
 * became a CLI one on screen and could not be filtered for at all (T-0105, D29).
 */
export type SessionSource = KnownSessionSource | (string & {});
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

/**
 * Whole-table figures for a session listing, over exactly the rows the
 * listing's filter selects rather than over the page it returns.
 *
 * The Sessions page draws four tiles from these. It used to draw them from the
 * loaded page instead, so the tile labelled TOTAL printed 50 beside a header
 * printing the real count (T-0042). `total` here is not counted separately
 * from the header's number: it IS the header's number, summed out of the same
 * one aggregate the rest of these fields come from, so a tile and the header
 * cannot come apart.
 */
export interface SessionTotals {
  /** Rows matching the filter. The number the page header prints. */
  total: number;
  /** Matching rows with status `active`. */
  active: number;
  /** SUM(message_count) over the matching rows. */
  messages: number;
  /**
   * Matching rows per `source`, keyed by the value stored in the column, not
   * by a fixed set of names. `source` is free text and real installs carry
   * values the UI has no bucket for (the operator's database holds `subagent`
   * and `tui` rows), and a fixed map counts those as nothing at all.
   */
  bySource: Record<string, number>;
}

export interface ListSessionsOptions {
  agentType?: AgentType;
  source?: string;
  status?: SessionStatus;
  missionId?: string | null;
  /**
   * Drop the API chatter: an api session under a kilobyte that lived less than
   * a minute. In SQL, so the tiles and the rows describe the same set.
   */
  excludeApiNoise?: boolean;
  /** Free-text search over title / id / profile / mission (case-insensitive). */
  search?: string;
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
  const database = getDb();
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
    input.agentType ?? getActiveFrameworkConfig().type,
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
  getDb().prepare(`UPDATE sessions SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
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
  const database = getDb();
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
  const row = getDb().prepare("SELECT * FROM sessions WHERE id = ?").get(id) as
    | SessionRow
    | undefined;
  return rowToSession(row);
}

/** One row of the totals aggregate. */
interface SessionTotalsRow {
  status: string;
  source: string;
  c: number;
  m: number;
}

/**
 * The whole-table figures behind the Sessions insight tiles, in ONE pass over
 * the rows `where`/`params` select.
 *
 * This replaces the listing's separate `SELECT COUNT(*)`: `total` is the sum
 * of the group counts, so the header's number and the tiles' numbers are
 * arithmetically the same number and the query count is unchanged.
 *
 * Cost, measured on 2026-08-26: the operator's database holds 35 sessions and
 * the aggregate runs in 0.09ms. Synthesised to 35,790 rows it is a full scan
 * plus a temp b-tree (there is no index on `status`) at 15.4ms median against
 * 0.013ms for the COUNT(*) it replaces, which is still far below the sync this
 * same request performs. A covering index on (status, source, message_count)
 * would bring it to 2.4ms if the table ever grows enough to want one; that is
 * a schema change and needs its own ruling.
 *
 * `message_count` is guarded rather than assumed: 001_baseline.sql predates
 * 006_sessions_message_count and `runMigrations` returns straight after
 * applying the baseline, so a fresh install's first boot has a `sessions`
 * table without that column. The same pragma guard the sync layer uses for
 * the same reason (operator ruling D6).
 */
function readSessionTotals(
  database: ReturnType<typeof getDb>,
  where: string,
  params: (string | number)[],
): SessionTotals {
  const messages = hasSessionMessageCountColumn(database)
    ? "COALESCE(SUM(message_count), 0)"
    : "0";
  const rows = database
    .prepare(/* sql */ `
      SELECT status, source, COUNT(*) AS c, ${messages} AS m
      FROM sessions
      ${where}
      GROUP BY status, source
    `)
    .all(...params) as SessionTotalsRow[];

  const totals: SessionTotals = { total: 0, active: 0, messages: 0, bySource: {} };
  for (const row of rows) {
    totals.total += row.c;
    totals.messages += row.m;
    if (row.status === "active") totals.active += row.c;
    totals.bySource[row.source] = (totals.bySource[row.source] ?? 0) + row.c;
  }
  return totals;
}

/**
 * How long one burst of list requests may share a single inline state.db sync.
 *
 * Every list request used to run the whole sync inline, so opening the page,
 * changing a filter and paging fired three full syncs of up to ten thousand
 * rows in a couple of seconds (T-0105, D35).
 */
const INLINE_SYNC_MIN_INTERVAL_MS = 2_000;
let lastInlineSyncAt = 0;

/** @public Reset the inline-sync guard between tests. */
export function _resetInlineSyncGuardForTests(): void {
  lastInlineSyncAt = 0;
}

export function listSessions(opts: ListSessionsOptions = {}): {
  sessions: SessionRecord[];
  total: number;
  totals: SessionTotals;
  sources: string[];
} {
  const {
    agentType,
    source,
    status,
    missionId,
    search,
    excludeApiNoise = false,
    limit = 50,
    offset = 0,
    syncIfActive = false,
  } = opts;

  // Optional one-shot sync from Hermes' state.db. Catches the currently-active
  // session before the periodic 15s sync cycle would have updated it. Wrapped
  // in try/catch because a failed sync must NEVER block the list response —
  // the user can still see whatever the last sync captured. The sync pipeline
  // itself lives in ./session-sync.
  if (syncIfActive && Date.now() - lastInlineSyncAt >= INLINE_SYNC_MIN_INTERVAL_MS) {
    // Stamped BEFORE the call: a sync that throws must not re-arm itself on
    // the very next request.
    lastInlineSyncAt = Date.now();
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
  // The source condition is held apart: the filter buttons are built from the
  // DISTINCT sources over everything ELSE, so filtering to one source does not
  // delete every other button and trap the operator on it (T-0105, D29).
  const sourceConditions = [...conditions];
  const sourceParams = [...params];
  if (source) {
    conditions.push("source = ?");
    params.push(source);
  }
  if (status) {
    conditions.push("status = ?");
    params.push(status);
    sourceConditions.push("status = ?");
    sourceParams.push(status);
  }
  if (missionId !== undefined) {
    conditions.push(missionId === null ? "mission_id IS NULL" : "mission_id = ?");
    if (missionId !== null) params.push(missionId);
  }

  // Server-side free-text search over the full table (not just the loaded page).
  // Mirrors sessionMatchesQuery's fields; LIKE is ASCII case-insensitive in
  // SQLite. Escape the user's % / _ so they match literally.
  const trimmedSearch = search?.trim();
  if (trimmedSearch) {
    const escaped = trimmedSearch.replace(/[\\%_]/g, (c) => `\\${c}`);
    const like = `%${escaped}%`;
    conditions.push(
      "(title LIKE ? ESCAPE '\\' OR id LIKE ? ESCAPE '\\' OR profile_name LIKE ? ESCAPE '\\' OR mission_id LIKE ? ESCAPE '\\')",
    );
    params.push(like, like, like, like);
  }

  if (excludeApiNoise) {
    // A duration, not an age. The client-side helper measured how long ago the
    // session STARTED, so a five-hour api session was hidden for its first
    // minute and shown for ever after (T-0105, D31). julianday parses the
    // ISO-8601 Z strings this table stores, and 'now' is UTC.
    const noise =
      `NOT (source = 'api' AND size < ${API_NOISE_MAX_BYTES}` +
      ` AND (julianday(COALESCE(ended_at, 'now')) - julianday(started_at)) * 86400000 <= ${API_NOISE_MAX_DURATION_MS})`;
    conditions.push(noise);
    sourceConditions.push(noise);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const sourceWhere = sourceConditions.length > 0 ? `WHERE ${sourceConditions.join(" AND ")}` : "";
  const database = getDb();
  // The listing's count and the insight tiles' figures come out of one query
  // over one filter. `total` is returned alongside `totals` because callers
  // (the page header, /api/monitor) read it by that name, but it is the same
  // number, not a second count that could drift from the first.
  const totals = readSessionTotals(database, where, params);

  const rows = database
    .prepare(
      `SELECT * FROM sessions ${where} ORDER BY started_at DESC LIMIT ? OFFSET ?`,
    )
    .all(...params, limit, offset) as SessionRow[];

  const sources = (
    database
      .prepare(`SELECT DISTINCT source FROM sessions ${sourceWhere} ORDER BY source ASC`)
      .all(...sourceParams) as { source: string }[]
  )
    .map((r) => r.source)
    .filter(Boolean);

  return {
    sessions: rows.map(rowToSession).filter(Boolean) as SessionRecord[],
    total: totals.total,
    totals,
    sources,
  };
}

// ── Shared helpers ─────────────────────────────────────────────

/**
 * Estimate session file size based on message and API call counts.
 * Used in both session-sync.ts (sync path) and sessions/[id]/route.ts (state.db path).
 * Formula: message_count * 200 + api_call_count * 50, floored at a minimum.
 * The minimum is per-caller — default 0 for bulk sync, caller provides for individual display.
 */
/**
 * `?? 0` catches null and undefined and NOT NaN, and the rows this is fed come
 * from a blind cast over the agent's own state.db (`state-db.ts` ends in
 * `.all() as HermesSessionRow[]`). A non-numeric message_count therefore
 * produced NaN, better-sqlite3 bound it as a double, SQLite stored a NaN double
 * as NULL, and the NOT NULL on `sessions.size` rejected the row. That is the
 * skip the log had been calling an "FK violation" for months (T-0064).
 *
 * Takes `unknown` deliberately: widening the parameter is what stops the
 * upstream cast being laundered by the type system a second time.
 */
export function estimateSessionSize(
  messageCount: unknown,
  apiCallCount: unknown,
  minSize = 0,
): number {
  const n = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  return Math.max(n(messageCount) * 200 + n(apiCallCount) * 50, minSize);
}
