// ═══════════════════════════════════════════════════════════════
// apply-agent-progression-migration.ts
//
// Creates the append-only per-Body progression record (031). Version guarded at
// schema_version 31, wired LAST in runMigrations.
//
// Uses execMigrationFile, so a genuine SQL failure propagates and the version is
// NOT bumped. See src/lib/db/apply-sql.ts for why that matters.
//
// The .sql carries two triggers as well as the table. `execIdempotent` swallows
// "already exists", which covers a re-run of CREATE TABLE, CREATE INDEX and
// CREATE TRIGGER alike, so a second apply on a database that already has them is
// a no-op rather than a failure.
// ═══════════════════════════════════════════════════════════════

import type Database from "better-sqlite3";
import { join } from "path";
import { getSchemaVersion, setSchemaVersion } from "@/lib/db-schema";
import { execMigrationFile } from "./apply-sql";

/**
 * The head of the migration ladder as of T-0016.
 * `MIGRATION_HEAD_SCHEMA_VERSION` in `src/lib/db-schema.ts` must equal this, and
 * `tests/unit/run-migrations-upgrade.integration.test.ts` asserts it does.
 */
export const AGENT_PROGRESSION_SCHEMA_VERSION = 31;

export function applyAgentProgressionMigration(
  database: Database.Database,
  migrationsDir: string,
): number {
  const current = getSchemaVersion(database);
  if (current >= AGENT_PROGRESSION_SCHEMA_VERSION) return current;

  execMigrationFile(database, join(migrationsDir, "031_agent_progression.sql"));

  setSchemaVersion(database, AGENT_PROGRESSION_SCHEMA_VERSION);
  return AGENT_PROGRESSION_SCHEMA_VERSION;
}
