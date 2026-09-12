/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports */

import { join } from "path";
import { execBaselineSchema } from "../helpers/baseline-db";

import { applyProfilesToolsParityUpgrade } from "@/lib/db/apply-profiles-tools-upgrade";
import {
  isProfilesToolsParityComplete,
  PROFILES_TOOLS_PARITY_SCHEMA_VERSION,
} from "@/lib/db/profiles-tools-parity-ensure";

function loadRealBetterSqlite3(): typeof import("better-sqlite3") {
  return require("better-sqlite3/lib/index.js") as typeof import("better-sqlite3");
}

const repoRoot = join(__dirname, "..", "..");
const migrationsDir = join(repoRoot, "src", "lib", "db", "migrations");

/** Simulates a main-branch v2 DB: meta says 2, no agent_root/skills tables. */
function createSchemaV2WithoutParityTables(): import("better-sqlite3").Database {
  const Database = loadRealBetterSqlite3();
  const database = new (Database as unknown as new (path: string) => import("better-sqlite3").Database)(
    ":memory:",
  );
  database.exec(`
    CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    INSERT INTO meta (key, value) VALUES ('schema_version', '2');

    CREATE TABLE agent_profiles (
      id            TEXT PRIMARY KEY,
      slug          TEXT NOT NULL UNIQUE,
      display_name  TEXT NOT NULL,
      description   TEXT NOT NULL DEFAULT '',
      personality   TEXT NOT NULL DEFAULT 'technical',
      config_yaml   TEXT NOT NULL DEFAULT '',
      soul_md       TEXT NOT NULL DEFAULT '',
      agents_md     TEXT NOT NULL DEFAULT '',
      seed_key      TEXT,
      synced_at     TEXT,
      sync_error    TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE missions (
      id                   TEXT PRIMARY KEY,
      name                 TEXT NOT NULL,
      prompt               TEXT NOT NULL,
      profile_id           TEXT DEFAULT 'default',
      status               TEXT NOT NULL DEFAULT 'queued',
      result               TEXT,
      session_id           TEXT,
      created_at           TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at           TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at           TEXT,
      local_dirs           TEXT NOT NULL DEFAULT '[]',
      references_          TEXT NOT NULL DEFAULT '[]',
      skills               TEXT NOT NULL DEFAULT '[]',
      goals                TEXT NOT NULL DEFAULT '[]',
      model_id             TEXT,
      provider             TEXT,
      profile_name         TEXT,
      mission_time_minutes INTEGER,
      timeout_minutes      INTEGER,
      schedule             TEXT,
      cron_job_id          TEXT,
      category_id          TEXT,
      output_format        TEXT NOT NULL DEFAULT '',
      constraints          TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE catalog_templates (
      id                   TEXT PRIMARY KEY,
      name                 TEXT NOT NULL,
      description          TEXT NOT NULL DEFAULT '',
      category_id          TEXT,
      instruction          TEXT NOT NULL DEFAULT '',
      context              TEXT NOT NULL DEFAULT '',
      goals                TEXT NOT NULL DEFAULT '[]',
      output_format        TEXT NOT NULL DEFAULT '',
      constraints          TEXT NOT NULL DEFAULT '',
      suggested_skills     TEXT NOT NULL DEFAULT '[]',
      local_dirs           TEXT NOT NULL DEFAULT '[]',
      references_          TEXT NOT NULL DEFAULT '[]',
      mission_time_minutes INTEGER,
      seed_key             TEXT,
      created_at           TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at           TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE tool_plugins (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );
  `);
  return database;
}

describe("v2 -> v3 migration (002 parity)", () => {
  it("applies 002 when schema_version is 2 and sets version to 3", () => {
    const database = createSchemaV2WithoutParityTables();
    expect(isProfilesToolsParityComplete(database)).toBe(false);

    const version = applyProfilesToolsParityUpgrade(database, migrationsDir);

    expect(version).toBe(PROFILES_TOOLS_PARITY_SCHEMA_VERSION);
    const row = database
      .prepare("SELECT value FROM meta WHERE key = 'schema_version'")
      .get() as { value: string };
    expect(parseInt(row.value, 10)).toBe(3);
    expect(isProfilesToolsParityComplete(database)).toBe(true);
    database.close();
  });

  it("does not re-run 002 when schema_version is already 3", () => {
    const Database = loadRealBetterSqlite3();
    const database = new (Database as unknown as new (path: string) => import("better-sqlite3").Database)(
      ":memory:",
    );
    execBaselineSchema(database);

    const version = applyProfilesToolsParityUpgrade(database, migrationsDir);
    expect(version).toBe(3);
    expect(isProfilesToolsParityComplete(database)).toBe(true);
    database.close();
  });
});
