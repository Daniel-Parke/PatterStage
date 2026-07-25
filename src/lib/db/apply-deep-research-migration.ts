// ═══════════════════════════════════════════════════════════════
// apply-deep-research-migration.ts
//
// Creates the DeepResearch tables (research_runs / research_steps — see
// 019_deep_research.sql). Version-guarded at schema_version 19, wired LAST in
// runMigrations. Idempotent CREATE ... IF NOT EXISTS.
// ═══════════════════════════════════════════════════════════════

import type Database from "better-sqlite3";
import { join } from "path";
import { getSchemaVersion, setSchemaVersion } from "@/lib/db-schema";
import { execMigrationFile } from "./apply-sql";

const DEEP_RESEARCH_SCHEMA_VERSION = 19;

export function applyDeepResearchMigration(
  database: Database.Database,
  migrationsDir: string,
): number {
  const current = getSchemaVersion(database);
  if (current >= DEEP_RESEARCH_SCHEMA_VERSION) return current;

  execMigrationFile(database, join(migrationsDir, "019_deep_research.sql"));

  setSchemaVersion(database, DEEP_RESEARCH_SCHEMA_VERSION);
  return DEEP_RESEARCH_SCHEMA_VERSION;
}
