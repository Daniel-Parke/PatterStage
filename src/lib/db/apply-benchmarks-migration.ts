// ═══════════════════════════════════════════════════════════════
// apply-benchmarks-migration.ts
//
// Creates the benchmark_runs + benchmark_item_results tables (see
// 014_benchmarks.sql). Idempotent (CREATE ... IF NOT EXISTS), wired LAST in
// runMigrations at schema_version 14 so it lands on fresh installs and
// already-migrated DBs alike. See [[db-migration-applier-footgun]] — a .sql
// file is inert without a version-guarded applier wired into runMigrations().
// ═══════════════════════════════════════════════════════════════

import type Database from "better-sqlite3";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { getSchemaVersion, setSchemaVersion } from "@/lib/db-schema";

export const BENCHMARKS_SCHEMA_VERSION = 14;

export function applyBenchmarksMigration(
  database: Database.Database,
  migrationsDir: string,
): number {
  const current = getSchemaVersion(database);
  if (current >= BENCHMARKS_SCHEMA_VERSION) return current;

  const path = join(migrationsDir, "014_benchmarks.sql");
  if (existsSync(path)) {
    try {
      database.exec(readFileSync(path, "utf-8"));
    } catch {
      // CREATE ... IF NOT EXISTS is idempotent; ignore partial-apply races.
    }
  }

  setSchemaVersion(database, BENCHMARKS_SCHEMA_VERSION);
  return BENCHMARKS_SCHEMA_VERSION;
}
