// ═══════════════════════════════════════════════════════════════
// apply-benchmark-config-migration.ts
//
// Adds the (Agent + LLM) unit + augmentation-tag columns (see
// 015_benchmark_config.sql). Version-guarded at schema_version 15 and wired
// LAST in runMigrations. Unlike the CREATE-IF-NOT-EXISTS migrations, ALTER ADD
// COLUMN is not idempotent, so each statement runs in its own try/catch — a
// duplicate-column error on a partially-applied DB is swallowed and the rest
// still apply. See [[db-migration-applier-footgun]].
// ═══════════════════════════════════════════════════════════════

import type Database from "better-sqlite3";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { getSchemaVersion, setSchemaVersion } from "@/lib/db-schema";

export const BENCHMARK_CONFIG_SCHEMA_VERSION = 15;

export function applyBenchmarkConfigMigration(
  database: Database.Database,
  migrationsDir: string,
): number {
  const current = getSchemaVersion(database);
  if (current >= BENCHMARK_CONFIG_SCHEMA_VERSION) return current;

  const path = join(migrationsDir, "015_benchmark_config.sql");
  if (existsSync(path)) {
    const raw = readFileSync(path, "utf-8");
    // Drop comment lines, then run each statement individually so one
    // already-applied ALTER doesn't abort the rest.
    const sql = raw
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n");
    for (const stmt of sql.split(";")) {
      const s = stmt.trim();
      if (!s) continue;
      try {
        database.exec(s);
      } catch {
        // column already exists (partial prior apply) — ignore
      }
    }
  }

  setSchemaVersion(database, BENCHMARK_CONFIG_SCHEMA_VERSION);
  return BENCHMARK_CONFIG_SCHEMA_VERSION;
}
