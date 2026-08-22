// ═══════════════════════════════════════════════════════════════
// apply-benchmarks-migration.ts
//
// Creates the benchmark_runs + benchmark_item_results tables (see
// 014_benchmarks.sql). Idempotent (CREATE ... IF NOT EXISTS), wired LAST in
// runMigrations at schema_version 14 so it lands on fresh installs and
// already-migrated DBs alike. See [[db-migration-applier-footgun]] — a .sql
// file is inert without a version-guarded applier wired into runMigrations().
//
// VESTIGIAL as of the benchmark deletion (org/decisions/ADR-0004-brain-and-body.md).
// Creates benchmark_runs + benchmark_item_results, which nothing reads or writes.
// The feature is gone; this applier is NOT. schema_version is a strictly
// increasing chain to 29, so deleting a migration in the middle would renumber
// every later one and break every existing database. It stays as a no-op-shaped
// version bump, and the tables stay permanently empty. That is a schema-history
// tax on the decision, not a sign the feature is coming back.
// ═══════════════════════════════════════════════════════════════

import type Database from "better-sqlite3";
import { join } from "path";
import { getSchemaVersion, setSchemaVersion } from "@/lib/db-schema";
import { execMigrationFile } from "./apply-sql";

const BENCHMARKS_SCHEMA_VERSION = 14;

export function applyBenchmarksMigration(
  database: Database.Database,
  migrationsDir: string,
): number {
  const current = getSchemaVersion(database);
  if (current >= BENCHMARKS_SCHEMA_VERSION) return current;

  execMigrationFile(database, join(migrationsDir, "014_benchmarks.sql"));

  setSchemaVersion(database, BENCHMARKS_SCHEMA_VERSION);
  return BENCHMARKS_SCHEMA_VERSION;
}
