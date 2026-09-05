// ═══════════════════════════════════════════════════════════════
// apply-analytics-events-migration.ts
//
// Creates the analytics_events interaction log (see 012_analytics_events.sql).
// Idempotent (CREATE ... IF NOT EXISTS), wired LAST in runMigrations at
// schema_version 12 so it lands on fresh installs and already-migrated dev DBs
// alike. See [[db-migration-applier-footgun]] — a .sql file is inert without a
// version-guarded applier wired into runMigrations().
// ═══════════════════════════════════════════════════════════════

import type Database from "better-sqlite3";
import { join } from "path";
import { getSchemaVersion, setSchemaVersion } from "@/lib/db-schema";
import { execMigrationFile } from "./apply-sql";

export const ANALYTICS_EVENTS_SCHEMA_VERSION = 12;

export function applyAnalyticsEventsMigration(
  database: Database.Database,
  migrationsDir: string,
): number {
  const current = getSchemaVersion(database);
  if (current >= ANALYTICS_EVENTS_SCHEMA_VERSION) return current;

  execMigrationFile(database, join(migrationsDir, "012_analytics_events.sql"));

  setSchemaVersion(database, ANALYTICS_EVENTS_SCHEMA_VERSION);
  return ANALYTICS_EVENTS_SCHEMA_VERSION;
}
