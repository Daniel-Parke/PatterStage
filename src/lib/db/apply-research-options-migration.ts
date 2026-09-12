// ═══════════════════════════════════════════════════════════════
// apply-research-options-migration.ts
//
// Adds research_runs.config_json (the options a run used) + the research_presets
// table (see 023_research_options.sql). Version-guarded at schema_version 23,
// wired LAST in runMigrations. CREATE ... IF NOT EXISTS + guarded ALTER.
// ═══════════════════════════════════════════════════════════════

import type Database from "better-sqlite3";
import { join } from "path";
import { getSchemaVersion, setSchemaVersion } from "@/lib/db-schema";
import { execMigrationFile } from "./apply-sql";

const RESEARCH_OPTIONS_SCHEMA_VERSION = 23;

export function applyResearchOptionsMigration(
  database: Database.Database,
  migrationsDir: string,
): number {
  const current = getSchemaVersion(database);
  if (current >= RESEARCH_OPTIONS_SCHEMA_VERSION) return current;

  execMigrationFile(database, join(migrationsDir, "023_research_options.sql"));

  try {
    database.exec("ALTER TABLE research_runs ADD COLUMN config_json TEXT");
  } catch {
    // column already present (re-run / older partial apply)
  }

  setSchemaVersion(database, RESEARCH_OPTIONS_SCHEMA_VERSION);
  return RESEARCH_OPTIONS_SCHEMA_VERSION;
}
