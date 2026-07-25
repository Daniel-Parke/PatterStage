// ═══════════════════════════════════════════════════════════════
// apply-benchmark-catalog-migration.ts
//
// Creates the tool_catalog + seed_memory_facts tables (see
// 016_benchmark_catalog.sql) — the central fair-test catalog. Idempotent
// (CREATE ... IF NOT EXISTS), version-guarded at schema_version 16, wired LAST
// in runMigrations. See [[db-migration-applier-footgun]].
// ═══════════════════════════════════════════════════════════════
//
// NOT vestigial, despite the name. tool_catalog and seed_memory_facts outlived
// the benchmark subsystem that introduced them: they are now owned by
// src/lib/seed/catalog-seed.ts and src/lib/memory-catalog-repository.ts. Only the
// filename still says benchmark.
// ═══════════════════════════════════════════════════════════════

import type Database from "better-sqlite3";
import { join } from "path";
import { getSchemaVersion, setSchemaVersion } from "@/lib/db-schema";
import { execMigrationFile } from "./apply-sql";

const BENCHMARK_CATALOG_SCHEMA_VERSION = 16;

export function applyBenchmarkCatalogMigration(
  database: Database.Database,
  migrationsDir: string,
): number {
  const current = getSchemaVersion(database);
  if (current >= BENCHMARK_CATALOG_SCHEMA_VERSION) return current;

  execMigrationFile(database, join(migrationsDir, "016_benchmark_catalog.sql"));

  setSchemaVersion(database, BENCHMARK_CATALOG_SCHEMA_VERSION);
  return BENCHMARK_CATALOG_SCHEMA_VERSION;
}
