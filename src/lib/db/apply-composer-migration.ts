// ═══════════════════════════════════════════════════════════════
// apply-composer-migration.ts
//
// Creates the Composer graph tables (see 021_composer.sql) and adds
// runs.composer_node_run_id (so reconcile can branch a mission-run from a
// Composer stage-run). Version-guarded at schema_version 21, wired LAST in
// runMigrations. CREATE ... IF NOT EXISTS + guarded ALTER.
// ═══════════════════════════════════════════════════════════════

import type Database from "better-sqlite3";
import { join } from "path";
import { getSchemaVersion, setSchemaVersion } from "@/lib/db-schema";
import { execMigrationFile } from "./apply-sql";

const COMPOSER_SCHEMA_VERSION = 21;

export function applyComposerMigration(
  database: Database.Database,
  migrationsDir: string,
): number {
  const current = getSchemaVersion(database);
  if (current >= COMPOSER_SCHEMA_VERSION) return current;

  execMigrationFile(database, join(migrationsDir, "021_composer.sql"));

  try {
    database.exec("ALTER TABLE runs ADD COLUMN composer_node_run_id TEXT");
  } catch {
    // column already present (re-run / older partial apply)
  }

  setSchemaVersion(database, COMPOSER_SCHEMA_VERSION);
  return COMPOSER_SCHEMA_VERSION;
}
