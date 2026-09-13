// ═══════════════════════════════════════════════════════════════
// apply-composer-group-link-migration.ts
//
// Adds composer_runs.parent_node_run_id (link a nested sub-workflow run to the
// "group" node-run that spawned it — see 026_composer_group_link.sql).
// Version-guarded at schema_version 26, wired LAST in runMigrations. Guarded
// ALTER, idempotent.
// ═══════════════════════════════════════════════════════════════

import type Database from "better-sqlite3";
import { join } from "path";
import { getSchemaVersion, setSchemaVersion } from "@/lib/db-schema";
import { execMigrationFile } from "./apply-sql";

const COMPOSER_GROUP_LINK_SCHEMA_VERSION = 26;

export function applyComposerGroupLinkMigration(
  database: Database.Database,
  migrationsDir: string,
): number {
  const current = getSchemaVersion(database);
  if (current >= COMPOSER_GROUP_LINK_SCHEMA_VERSION) return current;

  execMigrationFile(database, join(migrationsDir, "026_composer_group_link.sql"));

  try {
    database.exec("ALTER TABLE composer_runs ADD COLUMN parent_node_run_id TEXT");
  } catch {
    // column already present (re-run / older partial apply)
  }

  setSchemaVersion(database, COMPOSER_GROUP_LINK_SCHEMA_VERSION);
  return COMPOSER_GROUP_LINK_SCHEMA_VERSION;
}
