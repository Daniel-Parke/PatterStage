// ═══════════════════════════════════════════════════════════════
// apply-models-origin-migration.ts
//
// Adds models.origin and the last-imported pair (see 039_models_origin.sql),
// so an import can tell its own previous values from an operator's edits.
// Version-guarded at schema_version 39, wired LAST in runMigrations. The
// guard is what keeps the file's backfill correct: execMigrationFile runs the
// whole .sql in one exec and swallows an already-applied error, so a second
// run against a database that already has the columns would never reach the
// UPDATE. See [[db-migration-applier-footgun]].
// ═══════════════════════════════════════════════════════════════

import type Database from "better-sqlite3";
import { join } from "path";
import { getSchemaVersion, setSchemaVersion } from "@/lib/db-schema";
import { execMigrationFile } from "./apply-sql";

/**
 * The head of the migration ladder as of T-0100.
 * `MIGRATION_HEAD_SCHEMA_VERSION` in `src/lib/db-schema.ts` must equal this, and
 * `tests/unit/run-migrations-upgrade.integration.test.ts` asserts it does.
 */
export const MODELS_ORIGIN_SCHEMA_VERSION = 39;

export function applyModelsOriginMigration(
  database: Database.Database,
  migrationsDir: string,
): number {
  const current = getSchemaVersion(database);
  if (current >= MODELS_ORIGIN_SCHEMA_VERSION) return current;

  execMigrationFile(database, join(migrationsDir, "039_models_origin.sql"));

  setSchemaVersion(database, MODELS_ORIGIN_SCHEMA_VERSION);
  return MODELS_ORIGIN_SCHEMA_VERSION;
}
