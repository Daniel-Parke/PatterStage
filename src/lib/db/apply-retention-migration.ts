// ═══════════════════════════════════════════════════════════════
// apply-retention-migration.ts
//
// Creates the declared retention policy and the append-only prune record (032).
// Version guarded at schema_version 32, wired LAST in runMigrations.
//
// Uses execMigrationFile, so a genuine SQL failure propagates and the version is
// NOT bumped. See src/lib/db/apply-sql.ts for why that matters.
//
// This applier deletes nothing and enables nothing. The policy rows it seeds
// carry enabled = 0 on every install, fresh and existing, and the seed is
// INSERT OR IGNORE so a re-run cannot overwrite a choice an operator already
// made. An upgrade is not a moment at which anybody's history disappears.
// ═══════════════════════════════════════════════════════════════

import type Database from "better-sqlite3";
import { join } from "path";
import { getSchemaVersion, setSchemaVersion } from "@/lib/db-schema";
import { execMigrationFile } from "./apply-sql";

/**
 * The head of the migration ladder as of T-0017.
 * `MIGRATION_HEAD_SCHEMA_VERSION` in `src/lib/db-schema.ts` must equal this, and
 * `tests/unit/run-migrations-upgrade.integration.test.ts` asserts it does.
 */
export const RETENTION_SCHEMA_VERSION = 32;

export function applyRetentionMigration(
  database: Database.Database,
  migrationsDir: string,
): number {
  const current = getSchemaVersion(database);
  if (current >= RETENTION_SCHEMA_VERSION) return current;

  execMigrationFile(database, join(migrationsDir, "032_retention.sql"));

  setSchemaVersion(database, RETENTION_SCHEMA_VERSION);
  return RETENTION_SCHEMA_VERSION;
}
