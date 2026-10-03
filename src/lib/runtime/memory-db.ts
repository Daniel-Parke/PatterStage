// ═══════════════════════════════════════════════════════════════
// runtime/memory-db.ts — reading the agent's own long-term memory store
//
// The holographic memory provider keeps its facts in a SQLite file
// inside the agent's workspace. That file is the AGENT's database, not
// PatterStage's, so the statement that counts its rows is not a
// repository concern: a repository speaks for PatterStage's schema,
// and filing a foreign-database read under a *repository* name would
// only hide it from `sql-outside-repository` (which exempts every path
// matching /repository/i) rather than put it where it belongs.
//
// Where it belongs is here. src/lib/runtime/ is the adapter layer that
// is already allowed to know the agent's on-disk layout, and
// workspace.ts already resolves memoryDb for exactly this caller.
//
// The read is opened read-only and closed in a finally, and every
// failure path answers 0: a missing file, a store without a `facts`
// table, a lock. MemorySync runs on a schedule and a throw here would
// take down a whole tick to report a number that is only ever
// displayed.
// ═══════════════════════════════════════════════════════════════

import Database from "better-sqlite3";
import { existsSync } from "fs";

import { getAgentWorkspace } from "./workspace";

/** Fact count from the agent's local memory store (holographic provider). */
export function readHolographicFactCount(): number {
  try {
    const dbPath = getAgentWorkspace().memoryDb;
    if (!existsSync(dbPath)) return 0;

    const memDb = new Database(dbPath, { readonly: true });
    try {
      // design-lint-disable-next-line sql-outside-repository -- foreign database: this is the agent's own memory store, and the only alternative that silences the rule is a *repository* filename, which would hide the read behind the /repository/i exemption instead of putting it in the adapter layer
      const row = memDb.prepare("SELECT COUNT(*) as count FROM facts").get() as { count: number };
      return row.count;
    } finally {
      memDb.close();
    }
  } catch {
    return 0;
  }
}
