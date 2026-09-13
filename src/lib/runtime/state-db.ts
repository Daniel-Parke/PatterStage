// ═══════════════════════════════════════════════════════════════
// runtime/state-db.ts — reading the agent's own state.db
//
// This is the ONE place that opens the agent's session database. Two
// callers used to open it themselves: the sessions sync pipeline, which
// reads every session on a 15s cycle, and the per-session transcript
// route, which reads one session and its messages.
//
// It is in the adapter layer rather than behind a *repository* name on
// purpose. `sql-outside-repository` exempts every path matching
// /repository/i, so calling this a repository would delete the
// violation from the report without moving the code anywhere better,
// and the rule exists to keep a table shape from becoming a public
// interface. This is not PatterStage's table shape at all; it is the
// agent's, and src/lib/runtime/ is the layer already licensed to know
// the agent's on-disk layout (org/decisions/ADR-0002). The two
// statements therefore carry the lint's pragma with that reason
// written at the line.
//
// Failure policy differs between the two readers, and deliberately:
//
//   - readHermesSessionsFromStateDb answers [] on every failure. The
//     sync cycle runs every 15s and a throw would take down a whole
//     tick to report that nothing was learned.
//   - readAgentSessionDetail throws. Its caller logs the failure
//     against the request and falls through to the legacy file-based
//     lookup, so swallowing here would hide a broken state.db behind
//     an empty transcript.
// ═══════════════════════════════════════════════════════════════

import Database from "better-sqlite3";
import { existsSync } from "fs";
import { join } from "path";

import { getAgentWorkspace } from "./workspace";

export interface HermesSessionRow {
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

/** One message row as the agent stores it. Reachable through HermesSessionDetail. */
interface HermesMessageRow {
  role: string;
  content: string | null;
  tool_name: string | null;
  tool_calls: string | null;
  tool_call_id: string | null;
  finish_reason: string | null;
  reasoning: string | null;
  timestamp: number;
}

/** One session plus its message history, read in a single open. */
export interface HermesSessionDetail {
  session: HermesSessionRow;
  messages: HermesMessageRow[];
  /** True when older messages were left behind by `messageLimit`. */
  truncated: boolean;
}

/** Absolute path to the active agent's session database. */
function stateDbPath(): string {
  return join(getAgentWorkspace().root, "state.db");
}

/**
 * Read session metadata out of the agent's state.db (v0.14+).
 *
 * Every failure path returns an empty array rather than throwing: a
 * missing file, a database without a `sessions` table, a lock, a
 * schema we do not recognise. The sync cycle runs every 15s and a
 * throw here would take the whole tick down, so an empty read is the
 * honest answer: nothing was learned this tick.
 */
export function readHermesSessionsFromStateDb(): HermesSessionRow[] {
  const path = stateDbPath();
  if (!existsSync(path)) return [];

  let hermesDb: Database.Database | null = null;
  try {
    hermesDb = new Database(path, { readonly: true });

    // design-lint-disable-next-line sql-outside-repository -- foreign database: the agent's own state.db, not PatterStage's schema, so the adapter layer owns it and a *repository* filename would only hide it behind the /repository/i exemption
    const tables = hermesDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'").all();
    if (tables.length === 0) {
      hermesDb.close();
      hermesDb = null;
      return [];
    }

    // LIMIT bounds the sync cost on a giant state.db. The /api/sessions
    // route paginates 50 per page anyway, and 10K is a generous ceiling
    // for any UI use case. The full set can still be inspected via the
    // Hermes CLI (`hermes sessions list`). See session-repository.ts
    // header for the FTS-bloat rationale.
    // design-lint-disable-next-line sql-outside-repository -- foreign database: the agent's own state.db, not PatterStage's schema, so the adapter layer owns it and a *repository* filename would only hide it behind the /repository/i exemption
    const rows = hermesDb.prepare(
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
 * Read one session and its messages from the agent's state.db.
 *
 * Returns null when there is no state.db, or when it holds no session
 * with that id; the caller then falls through to the legacy file-based
 * lookup. Throws on a real read failure so the caller can log it
 * against the request.
 *
 * Session and messages are read through a SINGLE open, which is what
 * the transcript route did inline: two opens would double the lock
 * contention with a live agent for no benefit.
 */
/**
 * @param messageLimit  Keep only the newest N messages. Omit for all of them.
 */
export function readAgentSessionDetail(
  sessionId: string,
  messageLimit?: number,
): HermesSessionDetail | null {
  const path = stateDbPath();
  if (!existsSync(path)) return null;

  let hermesDb: Database.Database | null = null;
  try {
    hermesDb = new Database(path, { readonly: true });

    // design-lint-disable-next-line sql-outside-repository -- foreign database: the agent's own state.db, not PatterStage's schema, so the adapter layer owns it and a *repository* filename would only hide it behind the /repository/i exemption
    const session = hermesDb.prepare("SELECT id, source, model, title, started_at, ended_at, end_reason, message_count, api_call_count FROM sessions WHERE id = ?")
      .get(sessionId) as HermesSessionRow | undefined;

    if (!session) return null;

    const capped = typeof messageLimit === "number" && Number.isFinite(messageLimit) && messageLimit > 0;
    if (capped) {
      // Newest first, one more than asked for, so "there are more" is a fact
      // rather than a guess; then reversed, because a transcript reads
      // oldest-first (T-0105, D40).
      // design-lint-disable-next-line sql-outside-repository -- foreign database: the agent's own state.db, not PatterStage's schema, so the adapter layer owns it and a *repository* filename would only hide it behind the /repository/i exemption
      const newestFirst = hermesDb.prepare(
          `SELECT role, content, tool_name, tool_calls, tool_call_id, finish_reason, reasoning, timestamp
               FROM messages WHERE session_id = ? ORDER BY timestamp DESC LIMIT ?`,
        )
        .all(sessionId, messageLimit + 1) as HermesMessageRow[];
      const truncated = newestFirst.length > messageLimit;
      const kept = truncated ? newestFirst.slice(0, messageLimit) : newestFirst;
      return { session, messages: kept.reverse(), truncated };
    }

    // design-lint-disable-next-line sql-outside-repository -- foreign database: the agent's own state.db, not PatterStage's schema, so the adapter layer owns it and a *repository* filename would only hide it behind the /repository/i exemption
    const messages = hermesDb.prepare(
        `SELECT role, content, tool_name, tool_calls, tool_call_id, finish_reason, reasoning, timestamp
             FROM messages WHERE session_id = ? ORDER BY timestamp ASC`,
      )
      .all(sessionId) as HermesMessageRow[];

    return { session, messages, truncated: false };
  } finally {
    if (hermesDb) { try { hermesDb.close(); } catch { /* already closed */ } }
  }
}
