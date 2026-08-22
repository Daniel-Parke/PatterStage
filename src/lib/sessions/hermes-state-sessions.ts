// ═══════════════════════════════════════════════════════════════
// hermes-state-sessions.ts: reading Hermes's own state.db
//
// Split out of session-sync.ts. This is the ONE place that opens the
// agent's state database and speaks its vocabulary: the row shape it
// stores and the `end_reason` values it uses to say how a session
// ended. Everything downstream of `readHermesSessionsFromStateDb`
// works in PatterStage's own terms (SessionStatus + exit code), so
// the translation table lives here beside the reader rather than in
// the upsert pipeline that consumes it.
//
// The two prepared statements below read a FOREIGN database. They are
// carried in the design-lint baseline and their migration is T-0012's
// work, not this split's. Two constraints on where they may land:
// they must NOT end up in a file whose name matches /repository/i,
// because that pattern is exempt from `sql-outside-repository` and a
// rename would drop them out of lint sight rather than fix them; and
// their real destination is the runtime adapter (src/lib/runtime/),
// which is the layer already allowed to know the agent's on-disk
// layout.
// ═══════════════════════════════════════════════════════════════

import Database from "better-sqlite3";
import { existsSync } from "fs";
import { join } from "path";

import { getAgentWorkspace } from "../runtime/workspace";
import { type SessionStatus } from "./session-repository";

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

/**
 * Translate the agent's `end_reason` vocabulary into PatterStage's
 * (status, exitCode) pair. A null reason means the session is still
 * running; an unrecognised one is treated as a clean end with an
 * unknown exit code rather than a failure, because a reason we have
 * not seen before is not evidence of an error.
 */
export function hermesStatusFromEndReason(
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
  const root = getAgentWorkspace().root;
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
