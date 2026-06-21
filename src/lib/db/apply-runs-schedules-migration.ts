// ═══════════════════════════════════════════════════════════════
// apply-runs-schedules-migration.ts
//
// Adds the PatterStage-owned `schedules` + `runs` tables and the
// per-profile gateway columns / missions.run_id. The CREATE TABLEs live in
// 009_runs_schedules.sql (idempotent); column adds are done here because
// SQLite ALTER TABLE has no IF NOT EXISTS. Safe to run repeatedly.
// ═══════════════════════════════════════════════════════════════

import type Database from "better-sqlite3";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { getSchemaVersion, setSchemaVersion } from "@/lib/db-schema";

const RUNS_SCHEDULES_SCHEMA_VERSION = 8;

function columnExists(database: Database.Database, table: string, column: string): boolean {
  const rows = database.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return rows.some((r) => r.name === column);
}

function addColumnIfMissing(
  database: Database.Database,
  table: string,
  column: string,
  ddl: string,
): void {
  if (columnExists(database, table, column)) return;
  try {
    database.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl};`);
  } catch {
    // Idempotent on partial applies / concurrent boots.
  }
}

/** Create runs/schedules and add the new columns when schema_version < 8. */
export function applyRunsSchedulesMigration(
  database: Database.Database,
  migrationsDir: string,
): number {
  const current = getSchemaVersion(database);
  if (current >= RUNS_SCHEDULES_SCHEMA_VERSION) {
    return current;
  }

  const path = join(migrationsDir, "009_runs_schedules.sql");
  if (existsSync(path)) {
    try {
      database.exec(readFileSync(path, "utf-8"));
    } catch {
      // CREATE ... IF NOT EXISTS is idempotent; ignore partial-apply errors.
    }
  }

  addColumnIfMissing(database, "missions", "run_id", "run_id TEXT");
  addColumnIfMissing(database, "agent_profiles", "gateway_host", "gateway_host TEXT");
  addColumnIfMissing(database, "agent_profiles", "gateway_port", "gateway_port INTEGER");
  addColumnIfMissing(database, "agent_profiles", "api_key_ref", "api_key_ref TEXT");

  setSchemaVersion(database, RUNS_SCHEDULES_SCHEMA_VERSION);
  return RUNS_SCHEDULES_SCHEMA_VERSION;
}
