// ═══════════════════════════════════════════════════════════════
// apply-composer-node-cancelled-migration.ts
//
// Widens the composer_node_runs status CHECK to admit `cancelled` (037).
// Version guarded at schema_version 37, wired LAST in runMigrations.
//
// ONE TABLE, NOT TWO. `composer_runs` has admitted `cancelled` since 021 and
// 035 carried it through; only the node table's CHECK was missing it. Nothing
// in the schema holds a foreign key INTO composer_node_runs, so this rebuild
// has no inbound references to preserve — strictly simpler than 035's.
//
// LIKE 035, THIS IS A TABLE REBUILD, and it therefore does NOT use
// `execMigrationFile`, for two reasons that matter:
//
//   1. `execIdempotent` swallows "already exists" and "duplicate column name",
//      which is the right doctrine for an ADD COLUMN and the wrong one here. A
//      rebuild that half-applied and then hit "already exists" would be recorded
//      as done, leaving a database with a dropped table and no replacement.
//   2. A rebuild must be atomic. better-sqlite3's `transaction()` wrapper rolls
//      the whole thing back on any throw; `database.exec` on a multi-statement
//      script does not.
//
// `PRAGMA foreign_keys` cannot change inside a transaction, so it is set here,
// around the transaction, rather than in the .sql file. It is restored in a
// `finally`, so a failed rebuild does not leave the connection with foreign keys
// silently off for the rest of the process's life — which would be a far worse
// outcome than the failed migration itself.
//
// THE SHAPE GUARD is the point of this file. The migration copies an EXPLICIT
// column list, and the failure mode of a wrong list is not an error — it is a
// silent column drop. So the live shape is asserted against the list the .sql
// file copies, and a mismatch throws before anything is dropped. A future
// migration that adds a column to composer_node_runs without revisiting this
// one will fail loudly on the next boot instead of quietly discarding operator
// data.
// ═══════════════════════════════════════════════════════════════

import type Database from "better-sqlite3";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { getSchemaVersion, setSchemaVersion } from "@/lib/db-schema";

/**
 * The head of the migration ladder as of T-0076.
 * `MIGRATION_HEAD_SCHEMA_VERSION` in `src/lib/db-schema.ts` must equal this, and
 * `tests/unit/run-migrations-upgrade.integration.test.ts` asserts it does.
 */
export const COMPOSER_NODE_CANCELLED_SCHEMA_VERSION = 37;

/**
 * The exact column set the rebuilt table must have for
 * `037_composer_node_cancelled.sql`'s copy to be lossless. Order is irrelevant
 * (the SQL names every column on both sides); membership is not.
 */
const EXPECTED_COLUMNS: Record<string, readonly string[]> = {
  composer_node_runs: [
    "id", "composer_run_id", "node_id", "attempt", "status", "run_id", "input",
    "output", "verdict_json", "error", "started_at", "completed_at", "created_at",
  ],
};

function assertRebuildIsLossless(database: Database.Database, table: string): void {
  const live = (
    database.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]
  ).map((r) => r.name);
  const expected = EXPECTED_COLUMNS[table];
  const missing = expected.filter((c) => !live.includes(c));
  const extra = live.filter((c) => !expected.includes(c));
  if (missing.length === 0 && extra.length === 0) return;
  throw new Error(
    `Migration 035 refuses to rebuild ${table}: its columns have drifted from the ` +
      `set the migration copies. Unexpected: [${extra.join(", ")}]. ` +
      `Missing: [${missing.join(", ")}]. Add them to 037_composer_node_cancelled.sql's ` +
      `column lists and to EXPECTED_COLUMNS before this can run — rebuilding with ` +
      `a stale list would silently discard the unlisted columns.`,
  );
}

export function applyComposerNodeCancelledMigration(
  database: Database.Database,
  migrationsDir: string,
): number {
  const current = getSchemaVersion(database);
  if (current >= COMPOSER_NODE_CANCELLED_SCHEMA_VERSION) return current;

  const path = join(migrationsDir, "037_composer_node_cancelled.sql");
  // A missing file is not an error: prebuild-db.mjs ships a database that has
  // already had the migrations applied, and the .sql files are not always
  // deployed alongside it. Same contract as execMigrationFile.
  if (existsSync(path)) {
    assertRebuildIsLossless(database, "composer_node_runs");

    const sql = readFileSync(path, "utf-8");
    database.pragma("foreign_keys = OFF");
    try {
      database.transaction(() => database.exec(sql))();
    } finally {
      database.pragma("foreign_keys = ON");
    }
  }

  setSchemaVersion(database, COMPOSER_NODE_CANCELLED_SCHEMA_VERSION);
  return COMPOSER_NODE_CANCELLED_SCHEMA_VERSION;
}
