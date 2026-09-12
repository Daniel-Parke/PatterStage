// apply-composer-rejected-migration.ts: widens the two composer status CHECK
// constraints to admit `rejected` (035). Version guarded at schema_version 35,
// wired LAST in runMigrations.
//
// The first table rebuild in the chain, so NOT `execMigrationFile`:
// `execIdempotent` swallows "already exists", right for ADD COLUMN and wrong
// here, since a half-applied rebuild would be recorded as done with a dropped
// table and no replacement; and a rebuild must be atomic, which better-sqlite3's
// `transaction()` gives and `database.exec` on a multi-statement script does not.
//
// `PRAGMA foreign_keys` cannot change inside a transaction, so it is set around
// the transaction here, not in the .sql, and restored in a `finally` so a failed
// rebuild does not leave foreign keys silently off for the rest of the process.
//
// THE SHAPE GUARD is the point: the .sql copies an EXPLICIT column list, and a
// wrong list is not an error but a silent column drop. The live shape is
// asserted against that list and a mismatch throws before anything is dropped,
// so a later migration that adds a column fails loudly on the next boot.

import type Database from "better-sqlite3";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { getSchemaVersion, setSchemaVersion } from "@/lib/db-schema";

/**
 * The head of the migration ladder as of T-0069. `MIGRATION_HEAD_SCHEMA_VERSION`
 * in `src/lib/db-schema.ts` must equal this; `tests/unit/run-migrations-upgrade.integration.test.ts` asserts it.
 */
export const COMPOSER_REJECTED_SCHEMA_VERSION = 35;

/**
 * The exact column set each table must have for `035_composer_rejected.sql`'s
 * copy to be lossless. Order is irrelevant (the SQL names every column); membership is not.
 */
const EXPECTED_COLUMNS: Record<string, readonly string[]> = {
  composer_runs: [
    "id", "workflow_id", "status", "current_node_id", "input", "context_json",
    "profile_name", "error", "created_at", "updated_at", "completed_at",
    "parent_node_run_id",
  ],
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
      `Missing: [${missing.join(", ")}]. Add them to 035_composer_rejected.sql's ` +
      `column lists and to EXPECTED_COLUMNS before this can run — rebuilding with ` +
      `a stale list would silently discard the unlisted columns.`,
  );
}

export function applyComposerRejectedMigration(
  database: Database.Database,
  migrationsDir: string,
): number {
  const current = getSchemaVersion(database);
  if (current >= COMPOSER_REJECTED_SCHEMA_VERSION) return current;

  const path = join(migrationsDir, "035_composer_rejected.sql");
  // A missing file is not an error: prebuild-db.mjs ships a database already
  // migrated, without the .sql files beside it. Same contract as execMigrationFile.
  if (existsSync(path)) {
    assertRebuildIsLossless(database, "composer_runs");
    assertRebuildIsLossless(database, "composer_node_runs");

    const sql = readFileSync(path, "utf-8");
    database.pragma("foreign_keys = OFF");
    try {
      database.transaction(() => database.exec(sql))();
    } finally {
      database.pragma("foreign_keys = ON");
    }
  }

  setSchemaVersion(database, COMPOSER_REJECTED_SCHEMA_VERSION);
  return COMPOSER_REJECTED_SCHEMA_VERSION;
}
