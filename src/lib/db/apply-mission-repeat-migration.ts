import type Database from "better-sqlite3";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

const SCHEMA_VERSION_KEY = "schema_version";
const MISSION_REPEAT_FIX_SCHEMA_VERSION = 4;

function getSchemaVersion(database: Database.Database): number {
  try {
    const row = database
      .prepare("SELECT value FROM meta WHERE key = ?")
      .get(SCHEMA_VERSION_KEY) as { value: string } | undefined;
    return row ? parseInt(row.value, 10) : 0;
  } catch {
    return 0;
  }
}

function setSchemaVersion(database: Database.Database, version: number): void {
  database
    .prepare("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)")
    .run(SCHEMA_VERSION_KEY, String(version));
}

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
