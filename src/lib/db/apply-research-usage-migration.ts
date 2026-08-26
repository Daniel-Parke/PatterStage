// ═══════════════════════════════════════════════════════════════
// apply-research-usage-migration.ts
//
// Adds the three token columns to research_runs (034). Version guarded at
// schema_version 34, wired LAST in runMigrations.
//
// Uses execMigrationFile, so a genuine SQL failure propagates and the version
// is NOT bumped. See src/lib/db/apply-sql.ts for why that matters.
//
// This applier backfills NOTHING, deliberately. The new columns land NULL on
// every existing run, and NULL is the honest answer for a run whose usage was
// never recorded. Backfilling zeros would make every historical research run
// read as free, which is the exact misreporting T-0030 exists to remove.
// ═══════════════════════════════════════════════════════════════

import type Database from "better-sqlite3";
import { join } from "path";
import { getSchemaVersion, setSchemaVersion } from "@/lib/db-schema";
import { execMigrationFile } from "./apply-sql";

/**
 * The head of the migration ladder as of T-0030.
 * `MIGRATION_HEAD_SCHEMA_VERSION` in `src/lib/db-schema.ts` must equal this, and
 * `tests/unit/run-migrations-upgrade.integration.test.ts` asserts it does.
 */
export const RESEARCH_USAGE_SCHEMA_VERSION = 34;

export function applyResearchUsageMigration(
  database: Database.Database,
  migrationsDir: string,
): number {
  const current = getSchemaVersion(database);
  if (current >= RESEARCH_USAGE_SCHEMA_VERSION) return current;

  execMigrationFile(database, join(migrationsDir, "034_research_usage.sql"));

  setSchemaVersion(database, RESEARCH_USAGE_SCHEMA_VERSION);
  return RESEARCH_USAGE_SCHEMA_VERSION;
}
