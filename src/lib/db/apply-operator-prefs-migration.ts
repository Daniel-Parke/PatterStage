// ═══════════════════════════════════════════════════════════════
// apply-operator-prefs-migration.ts
//
// Creates operator_prefs (see 038_operator_prefs.sql): the console's own
// per-operator settings, behind the allow-list in operator-prefs-repository.
// Version-guarded at schema_version 38, wired LAST in runMigrations.
// CREATE ... IF NOT EXISTS is idempotent.
// ═══════════════════════════════════════════════════════════════

import type Database from "better-sqlite3";
import { join } from "path";
import { getSchemaVersion, setSchemaVersion } from "@/lib/db-schema";
import { execMigrationFile } from "./apply-sql";

/**
 * The head of the migration ladder as of T-0097.
 * `MIGRATION_HEAD_SCHEMA_VERSION` in `src/lib/db-schema.ts` must equal this, and
 * `tests/unit/run-migrations-upgrade.integration.test.ts` asserts it does.
 */
export const OPERATOR_PREFS_SCHEMA_VERSION = 38;

export function applyOperatorPrefsMigration(
  database: Database.Database,
  migrationsDir: string,
): number {
  const current = getSchemaVersion(database);
  if (current >= OPERATOR_PREFS_SCHEMA_VERSION) return current;

  execMigrationFile(database, join(migrationsDir, "038_operator_prefs.sql"));

  setSchemaVersion(database, OPERATOR_PREFS_SCHEMA_VERSION);
  return OPERATOR_PREFS_SCHEMA_VERSION;
}
