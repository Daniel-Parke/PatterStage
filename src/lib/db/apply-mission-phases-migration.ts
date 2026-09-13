// ═══════════════════════════════════════════════════════════════
// apply-mission-phases-migration.ts
//
// Creates the Mission V2 tables (mission_phases / mission_phase_actions /
// mission_approvals — see 018_mission_phases.sql) and adds the additive
// columns missions.version, missions.current_phase_id, runs.phase_action_id.
// Version-guarded at schema_version 18, wired LAST in runMigrations. ALTERs
// are guarded independently so a re-run can't abort the table create.
// See [[db-migration-applier-footgun]].
// ═══════════════════════════════════════════════════════════════

import type Database from "better-sqlite3";
import { join } from "path";
import { getSchemaVersion, setSchemaVersion } from "@/lib/db-schema";
import { execMigrationFile } from "./apply-sql";

const MISSION_PHASES_SCHEMA_VERSION = 18;

export function applyMissionPhasesMigration(
  database: Database.Database,
  migrationsDir: string,
): number {
  const current = getSchemaVersion(database);
  if (current >= MISSION_PHASES_SCHEMA_VERSION) return current;

  execMigrationFile(database, join(migrationsDir, "018_mission_phases.sql"));

  // Additive column adds. Each guarded independently: ADD COLUMN throws if the
  // column already exists, which must not skip setSchemaVersion below.
  for (const stmt of [
    "ALTER TABLE missions ADD COLUMN version TEXT NOT NULL DEFAULT 'v1'",
    "ALTER TABLE missions ADD COLUMN current_phase_id TEXT",
    "ALTER TABLE runs ADD COLUMN phase_action_id TEXT",
  ]) {
    try {
      database.exec(stmt);
    } catch {
      // column already present (re-run / older partial apply)
    }
  }

  setSchemaVersion(database, MISSION_PHASES_SCHEMA_VERSION);
  return MISSION_PHASES_SCHEMA_VERSION;
}
