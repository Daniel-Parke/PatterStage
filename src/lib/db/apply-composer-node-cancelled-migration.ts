// apply-composer-node-cancelled-migration.ts — widens the composer_node_runs
// status CHECK to admit `cancelled` (037), guarded at schema_version 37 and
// wired LAST in runMigrations. One table only: `composer_runs` has admitted it
// since 021, and nothing holds a foreign key INTO composer_node_runs.
//
// A TABLE REBUILD, like 035, so it does NOT use `execMigrationFile`:
// `execIdempotent` swallows "already exists", which would record a half-applied
// rebuild as done with the table dropped, and a rebuild must be atomic, which
// `database.exec` on a multi-statement script is not. `PRAGMA foreign_keys`
// cannot change inside a transaction, so it is set around it and restored in a
// `finally`, or a failed rebuild leaves foreign keys silently off for the process.
//
// THE SHAPE GUARD is the point: the .sql copies an EXPLICIT column list, and a
// wrong list is a silent column drop, not an error. The live shape is asserted
// against that list before anything is dropped, so a future column fails loudly.

import type Database from "better-sqlite3";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { getSchemaVersion, setSchemaVersion } from "@/lib/db-schema";

/** The head of the migration ladder as of T-0076; `MIGRATION_HEAD_SCHEMA_VERSION` in
 *  db-schema.ts must equal it, and run-migrations-upgrade.integration.test.ts asserts so. */
export const COMPOSER_NODE_CANCELLED_SCHEMA_VERSION = 37;

/** The column set 037's copy needs to be lossless. Order is irrelevant; membership is not. */
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
  // A missing file is not an error: prebuild-db.mjs ships an already-migrated
  // database without the .sql files, the same contract as execMigrationFile.
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
