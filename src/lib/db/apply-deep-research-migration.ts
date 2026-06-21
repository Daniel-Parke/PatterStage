// ═══════════════════════════════════════════════════════════════
// apply-deep-research-migration.ts
//
// Creates the DeepResearch tables (research_runs / research_steps — see
// 019_deep_research.sql). Version-guarded at schema_version 19, wired LAST in
// runMigrations. Idempotent CREATE ... IF NOT EXISTS.
// ═══════════════════════════════════════════════════════════════

import type Database from "better-sqlite3";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { getSchemaVersion, setSchemaVersion } from "@/lib/db-schema";

const DEEP_RESEARCH_SCHEMA_VERSION = 19;

export function applyDeepResearchMigration(
  database: Database.Database,
  migrationsDir: string,
): number {
  const current = getSchemaVersion(database);
  if (current >= DEEP_RESEARCH_SCHEMA_VERSION) return current;

  const path = join(migrationsDir, "019_deep_research.sql");
  if (existsSync(path)) {
    try {
      database.exec(readFileSync(path, "utf-8"));
    } catch {
      // CREATE ... IF NOT EXISTS is idempotent; ignore partial-apply races.
    }
  }

  setSchemaVersion(database, DEEP_RESEARCH_SCHEMA_VERSION);
  return DEEP_RESEARCH_SCHEMA_VERSION;
}
