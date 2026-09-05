// ═══════════════════════════════════════════════════════════════
// apply-runs-spend-source-migration.ts
//
// Adds runs.story_id and runs.spend_source (see 040_runs_spend_source.sql), so
// a run row says which feature spent the money and a story's spend stops being
// invisible to the console and the hard stop (T-0108, D87). Version-guarded at
// schema_version 40, wired LAST in runMigrations. The guard is what keeps the
// file's backfill correct: execMigrationFile runs the whole .sql in one exec
// and swallows an already-applied error, so a second run against a database
// that already has the columns would never reach the UPDATE.
// See [[db-migration-applier-footgun]].
// ═══════════════════════════════════════════════════════════════

import type Database from "better-sqlite3";
import { join } from "path";
import { getSchemaVersion, setSchemaVersion } from "@/lib/db-schema";
import { execMigrationFile } from "./apply-sql";

/**
 * The head of the migration ladder as of T-0108.
 * `MIGRATION_HEAD_SCHEMA_VERSION` in `src/lib/db-schema.ts` must equal this, and
 * `tests/unit/run-migrations-upgrade.integration.test.ts` asserts it does.
 */
export const RUNS_SPEND_SOURCE_SCHEMA_VERSION = 40;

export function applyRunsSpendSourceMigration(
  database: Database.Database,
  migrationsDir: string,
): number {
  const current = getSchemaVersion(database);
  if (current >= RUNS_SPEND_SOURCE_SCHEMA_VERSION) return current;

  execMigrationFile(database, join(migrationsDir, "040_runs_spend_source.sql"));

  setSchemaVersion(database, RUNS_SPEND_SOURCE_SCHEMA_VERSION);
  return RUNS_SPEND_SOURCE_SCHEMA_VERSION;
}
