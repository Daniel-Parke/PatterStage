// ═══════════════════════════════════════════════════════════════
// apply-schedule-kind-migration.ts
//
// Adds schedules.kind and schedules.script_name (see 041_schedule_kind.sql), so
// a schedule row can name a host script instead of a mission and PatterStage's
// own tick can run it where the host has no crontab (T-0107, decision 10).
// Version-guarded at schema_version 41, wired LAST in runMigrations.
//
// The .sql carries no backfill, deliberately: `kind` DEFAULTs to 'mission',
// which is what every row already is. That is what makes this file safe under
// execMigrationFile, which runs the whole .sql in one exec and swallows the
// first already-applied error. See [[db-migration-applier-footgun]].
// ═══════════════════════════════════════════════════════════════

import type Database from "better-sqlite3";
import { join } from "path";
import { getSchemaVersion, setSchemaVersion } from "@/lib/db-schema";
import { execMigrationFile } from "./apply-sql";

/**
 * The head of the migration ladder as of T-0107.
 * `MIGRATION_HEAD_SCHEMA_VERSION` in `src/lib/db-schema.ts` must equal this, and
 * `tests/unit/run-migrations-upgrade.integration.test.ts` asserts it does.
 */
export const SCHEDULE_KIND_SCHEMA_VERSION = 41;

export function applyScheduleKindMigration(
  database: Database.Database,
  migrationsDir: string,
): number {
  const current = getSchemaVersion(database);
  if (current >= SCHEDULE_KIND_SCHEMA_VERSION) return current;

  execMigrationFile(database, join(migrationsDir, "041_schedule_kind.sql"));

  setSchemaVersion(database, SCHEDULE_KIND_SCHEMA_VERSION);
  return SCHEDULE_KIND_SCHEMA_VERSION;
}
