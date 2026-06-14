// ═══════════════════════════════════════════════════════════════
// apply-game-tables-migration.ts
//
// Creates the gamification tables (010_game_tables.sql). Idempotent (the SQL is
// all CREATE ... IF NOT EXISTS), wired LAST in runMigrations at schema_version
// 10 so it lands on fresh installs and upgrades alike. See
// [[db-migration-applier-footgun]] — every migration needs a wired applier.
// ═══════════════════════════════════════════════════════════════

import type Database from "better-sqlite3";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { getSchemaVersion, setSchemaVersion } from "@/lib/db-schema";

export const GAME_TABLES_SCHEMA_VERSION = 10;

export function applyGameTablesMigration(database: Database.Database, migrationsDir: string): number {
  const current = getSchemaVersion(database);
  if (current >= GAME_TABLES_SCHEMA_VERSION) return current;

  const path = join(migrationsDir, "010_game_tables.sql");
  if (existsSync(path)) {
    try {
      database.exec(readFileSync(path, "utf-8"));
    } catch {
      // CREATE ... IF NOT EXISTS is idempotent; ignore partial-apply races.
    }
  }

  setSchemaVersion(database, GAME_TABLES_SCHEMA_VERSION);
  return GAME_TABLES_SCHEMA_VERSION;
}
