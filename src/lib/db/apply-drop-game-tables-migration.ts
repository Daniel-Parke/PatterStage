// ═══════════════════════════════════════════════════════════════
// apply-drop-game-tables-migration.ts
//
// Drops the gamification tables created by the removed 010_game_tables
// migration (the RPG/Gacha dial-back — see 011_drop_game_tables.sql).
// Idempotent (DROP ... IF EXISTS), wired LAST in runMigrations at
// schema_version 11 so it cleans already-migrated dev DBs and is a no-op on
// fresh installs. See [[db-migration-applier-footgun]] — every migration needs
// a wired applier.
// ═══════════════════════════════════════════════════════════════

import type Database from "better-sqlite3";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { getSchemaVersion, setSchemaVersion } from "@/lib/db-schema";

const DROP_GAME_TABLES_SCHEMA_VERSION = 11;

export function applyDropGameTablesMigration(database: Database.Database, migrationsDir: string): number {
  const current = getSchemaVersion(database);
  if (current >= DROP_GAME_TABLES_SCHEMA_VERSION) return current;

  const path = join(migrationsDir, "011_drop_game_tables.sql");
  if (existsSync(path)) {
    try {
      database.exec(readFileSync(path, "utf-8"));
    } catch {
      // DROP ... IF EXISTS is idempotent; ignore partial-apply races.
    }
  }

  setSchemaVersion(database, DROP_GAME_TABLES_SCHEMA_VERSION);
  return DROP_GAME_TABLES_SCHEMA_VERSION;
}
