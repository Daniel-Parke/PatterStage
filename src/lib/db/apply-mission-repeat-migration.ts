import type Database from "better-sqlite3";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { getSchemaVersion, setSchemaVersion } from "@/lib/db-schema";

const MISSION_REPEAT_FIX_SCHEMA_VERSION = 4;

/**
 * Apply 003_mission_infinite_repeat.sql when schema_version is below 4.
 */
export function applyMissionRepeatMigration(
  database: Database.Database,
  migrationsDir: string,
): number {
  const current = getSchemaVersion(database);
  if (current >= MISSION_REPEAT_FIX_SCHEMA_VERSION) {
    return current;
  }

  const path = join(migrationsDir, "003_mission_infinite_repeat.sql");
  if (existsSync(path)) {
    const sql = readFileSync(path, "utf-8");
    try {
      database.exec(sql);
    } catch {
      // Idempotent on partial applies.
    }
  }

  setSchemaVersion(database, MISSION_REPEAT_FIX_SCHEMA_VERSION);
  return MISSION_REPEAT_FIX_SCHEMA_VERSION;
}
