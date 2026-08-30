// ═══════════════════════════════════════════════════════════════
// apply-research-gather-migration.ts
//
// Adds the four gather-health columns to research_runs (036). Version guarded
// at schema_version 36, wired LAST in runMigrations.
//
// Uses execMigrationFile, so a genuine SQL failure propagates and the version is
// NOT bumped. Unlike 035 this is a plain additive ALTER, so the ordinary applier
// shape is the right one — see src/lib/db/apply-sql.ts.
//
// This applier backfills NOTHING, deliberately. A pre-036 run recorded nothing
// about its gather, and NULL is the honest answer for that. Backfilling zeros
// would report every historical run as a clean gather it was never measured to
// be (T-0070).
// ═══════════════════════════════════════════════════════════════

import type Database from "better-sqlite3";
import { join } from "path";
import { getSchemaVersion, setSchemaVersion } from "@/lib/db-schema";
import { execMigrationFile } from "./apply-sql";

/**
 * The head of the migration ladder as of T-0070.
 * `MIGRATION_HEAD_SCHEMA_VERSION` in `src/lib/db-schema.ts` must equal this, and
 * `tests/unit/run-migrations-upgrade.integration.test.ts` asserts it does.
 */
export const RESEARCH_GATHER_SCHEMA_VERSION = 36;

export function applyResearchGatherMigration(
  database: Database.Database,
  migrationsDir: string,
): number {
  const current = getSchemaVersion(database);
  if (current >= RESEARCH_GATHER_SCHEMA_VERSION) return current;

  execMigrationFile(database, join(migrationsDir, "036_research_gather_health.sql"));

  setSchemaVersion(database, RESEARCH_GATHER_SCHEMA_VERSION);
  return RESEARCH_GATHER_SCHEMA_VERSION;
}
