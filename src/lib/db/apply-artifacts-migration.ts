// ═══════════════════════════════════════════════════════════════
// apply-artifacts-migration.ts
//
// Creates the artifacts registry (see 028_artifacts.sql) — a unified catalog of
// agent-produced deliverables (Composer/Research/Mission outputs) so users can
// collect, view, and download them. Version-guarded at schema_version 28, wired
// LAST in runMigrations. CREATE ... IF NOT EXISTS is idempotent.
// ═══════════════════════════════════════════════════════════════

import type Database from "better-sqlite3";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { getSchemaVersion, setSchemaVersion } from "@/lib/db-schema";

const ARTIFACTS_SCHEMA_VERSION = 28;

export function applyArtifactsMigration(
  database: Database.Database,
  migrationsDir: string,
): number {
  const current = getSchemaVersion(database);
  if (current >= ARTIFACTS_SCHEMA_VERSION) return current;

  const path = join(migrationsDir, "028_artifacts.sql");
  if (existsSync(path)) {
    try {
      database.exec(readFileSync(path, "utf-8"));
    } catch {
      // CREATE ... IF NOT EXISTS is idempotent; ignore partial-apply races.
    }
  }

  setSchemaVersion(database, ARTIFACTS_SCHEMA_VERSION);
  return ARTIFACTS_SCHEMA_VERSION;
}
