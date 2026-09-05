// ═══════════════════════════════════════════════════════════════
// apply-research-composer-link-migration.ts
//
// Adds research_runs.composer_node_run_id (link a Deep Research run to the
// Composer node-run that spawned it — see 025_research_composer_link.sql).
// Version-guarded at schema_version 25, wired LAST in runMigrations. Guarded
// ALTER, idempotent.
// ═══════════════════════════════════════════════════════════════

import type Database from "better-sqlite3";
import { join } from "path";
import { getSchemaVersion, setSchemaVersion } from "@/lib/db-schema";
import { execMigrationFile } from "./apply-sql";

const RESEARCH_COMPOSER_LINK_SCHEMA_VERSION = 25;

export function applyResearchComposerLinkMigration(
  database: Database.Database,
  migrationsDir: string,
): number {
  const current = getSchemaVersion(database);
  if (current >= RESEARCH_COMPOSER_LINK_SCHEMA_VERSION) return current;

  execMigrationFile(database, join(migrationsDir, "025_research_composer_link.sql"));

  try {
    database.exec("ALTER TABLE research_runs ADD COLUMN composer_node_run_id TEXT");
  } catch {
    // column already present (re-run / older partial apply)
  }

  setSchemaVersion(database, RESEARCH_COMPOSER_LINK_SCHEMA_VERSION);
  return RESEARCH_COMPOSER_LINK_SCHEMA_VERSION;
}
