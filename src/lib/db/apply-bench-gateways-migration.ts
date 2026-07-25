// ═══════════════════════════════════════════════════════════════
// apply-bench-gateways-migration.ts
//
// Creates the bench_gateways tracking table (see 017_bench_gateways.sql) and
// adds benchmark_item_results.metrics_json (per-item trajectory metrics blob:
// tool calls, recovery, steps, latency — the research-grounded signal set that
// feeds the RPG stats). Version-guarded at schema_version 17, wired LAST in
// runMigrations. ALTER is guarded separately so a re-run can't abort the table
// create. See [[db-migration-applier-footgun]].
// ═══════════════════════════════════════════════════════════════

import type Database from "better-sqlite3";
import { join } from "path";
import { getSchemaVersion, setSchemaVersion } from "@/lib/db-schema";
import { execMigrationFile } from "./apply-sql";

const BENCH_GATEWAYS_SCHEMA_VERSION = 17;

export function applyBenchGatewaysMigration(
  database: Database.Database,
  migrationsDir: string,
): number {
  const current = getSchemaVersion(database);
  if (current >= BENCH_GATEWAYS_SCHEMA_VERSION) return current;

  execMigrationFile(database, join(migrationsDir, "017_bench_gateways.sql"));

  // Per-item trajectory metrics blob. Guarded independently: ADD COLUMN throws
  // if the column already exists, which must not skip setSchemaVersion below.
  try {
    database.exec(`ALTER TABLE benchmark_item_results ADD COLUMN metrics_json TEXT`);
  } catch {
    // column already present (re-run / older partial apply)
  }

  setSchemaVersion(database, BENCH_GATEWAYS_SCHEMA_VERSION);
  return BENCH_GATEWAYS_SCHEMA_VERSION;
}
