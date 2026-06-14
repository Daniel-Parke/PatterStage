// ═══════════════════════════════════════════════════════════════
// apply-legacy-column-repair.ts
//
// Catch-up migration for the two column-adds the incremental applier
// chain orphaned: 005_cron_workdir (cron_jobs.workdir) and
// 006_sessions_message_count (sessions.message_count).
//
// Root cause: applyCronScheduleCanonicalisation bumps schema_version
// straight from 5 to 7, so the "version 6" migrations (workdir +
// message_count) were never represented by an applier. Fresh installs
// receive both columns from the squashed baseline, but any DB upgraded
// through the incremental path — or already deployed at v7/v8 — never
// got them, surfacing as "no such column: workdir" at runtime on the
// missions and cron pages. (Observed on a real upgraded DB sitting at
// schema_version 8 with runs/schedules present but workdir absent.)
//
// Runs LAST (after runs/schedules at schema_version 8) at version 9 so
// it repairs already-deployed v8 installs as well as older DBs. Both
// column adds are idempotent (columnExists guard + try/catch), so a
// fresh baseline DB that already has the columns is a no-op.
// ═══════════════════════════════════════════════════════════════

import type Database from "better-sqlite3";
import { getSchemaVersion, setSchemaVersion } from "@/lib/db-schema";

export const LEGACY_COLUMN_REPAIR_SCHEMA_VERSION = 9;

function columnExists(database: Database.Database, table: string, column: string): boolean {
  try {
    const rows = database.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    return rows.some((r) => r.name === column);
  } catch {
    return false;
  }
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
    // Idempotent on partial applies / concurrent boots / missing table.
  }
}

/**
 * Ensure cron_jobs.workdir + sessions.message_count exist on any DB that
 * missed the orphaned 005/006 migrations. Idempotent; a no-op on fresh
 * baseline DBs (which already carry both columns) and on re-runs.
 */
export function applyLegacyColumnRepair(database: Database.Database): number {
  const current = getSchemaVersion(database);
  if (current >= LEGACY_COLUMN_REPAIR_SCHEMA_VERSION) {
    return current;
  }

  addColumnIfMissing(database, "cron_jobs", "workdir", "workdir TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(database, "sessions", "message_count", "message_count INTEGER");

  setSchemaVersion(database, LEGACY_COLUMN_REPAIR_SCHEMA_VERSION);
  return LEGACY_COLUMN_REPAIR_SCHEMA_VERSION;
}
