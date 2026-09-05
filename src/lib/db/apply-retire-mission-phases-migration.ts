// ═══════════════════════════════════════════════════════════════
// apply-retire-mission-phases-migration.ts
//
// Removes the superseded Mission-V2 phase foundation (see
// 020_retire_mission_phases.sql): drops the mission_phases tables and the
// additive missions/runs columns. Version-guarded at schema_version 20, wired
// LAST in runMigrations. The column drops are best-effort (SQLite >= 3.35);
// guarded so an older engine or a re-run can't abort the migration.
// ═══════════════════════════════════════════════════════════════

import type Database from "better-sqlite3";
import { join } from "path";
import { getSchemaVersion, setSchemaVersion } from "@/lib/db-schema";
import { execMigrationFile } from "./apply-sql";

const RETIRE_MISSION_PHASES_SCHEMA_VERSION = 20;

export function applyRetireMissionPhasesMigration(
  database: Database.Database,
  migrationsDir: string,
): number {
  const current = getSchemaVersion(database);
  if (current >= RETIRE_MISSION_PHASES_SCHEMA_VERSION) return current;

  execMigrationFile(database, join(migrationsDir, "020_retire_mission_phases.sql"));

  // Best-effort column removals. Harmless if unsupported / already dropped.
  for (const stmt of [
    "ALTER TABLE missions DROP COLUMN version",
    "ALTER TABLE missions DROP COLUMN current_phase_id",
    "ALTER TABLE runs DROP COLUMN phase_action_id",
  ]) {
    try {
      database.exec(stmt);
    } catch {
      // older SQLite without DROP COLUMN, or column already gone
    }
  }

  setSchemaVersion(database, RETIRE_MISSION_PHASES_SCHEMA_VERSION);
  return RETIRE_MISSION_PHASES_SCHEMA_VERSION;
}
