import type Database from "better-sqlite3";

function tableExists(database: Database.Database, name: string): boolean {
  const row = database
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(name) as { name: string } | undefined;
  return Boolean(row);
}

function columnExists(
  database: Database.Database,
  tableName: string,
  columnName: string,
): boolean {
  if (!tableExists(database, tableName)) return false;
  const columns = database
    .prepare(`PRAGMA table_info(${tableName})`)
    .all() as Array<{ name: string }>;
  return columns.some((column) => column.name === columnName);
}

/** Runtime schema version after v2 -> v3 parity (002 migration + ensure). */
export const PROFILES_TOOLS_PARITY_SCHEMA_VERSION = 3;

/** True when agent_root and skills exist (required for import-hermes-state / seed). */
export function isProfilesToolsParityComplete(database: Database.Database): boolean {
  return tableExists(database, "agent_root") && tableExists(database, "skills");
}

/** Idempotent v2 -> v3 parity fixes after SQL migrations. */
export function ensureProfilesToolsParity(database: Database.Database): void {
  if (tableExists(database, "tool_plugins")) {
    database.exec("DROP TABLE IF EXISTS tool_plugins");
  }

  if (!tableExists(database, "agent_root")) {
    database.exec(`
      CREATE TABLE IF NOT EXISTS agent_root (
        id                  INTEGER PRIMARY KEY CHECK (id = 1),
        display_name        TEXT NOT NULL DEFAULT 'Bob',
        description         TEXT NOT NULL DEFAULT '',
        personality         TEXT NOT NULL DEFAULT 'technical',
        config_yaml         TEXT NOT NULL DEFAULT '',
        soul_md             TEXT NOT NULL DEFAULT '',
        agents_md           TEXT NOT NULL DEFAULT '',
        framework_md           TEXT NOT NULL DEFAULT '',
        user_md             TEXT NOT NULL DEFAULT '',
        memory_md           TEXT NOT NULL DEFAULT '',
        disabled_skills     TEXT NOT NULL DEFAULT '[]',
        platform_toolsets   TEXT NOT NULL DEFAULT '{}',
        synced_at           TEXT,
        sync_error          TEXT,
        updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT OR IGNORE INTO agent_root (id, display_name, description)
      -- design-lint-disable-next-line hermes-outside-adapter -- seed data, not a path lookup: the env var name is one word inside a human description of the root agent, shown to whoever opens the row. The pragma is a SQL comment because the line it guards is SQL.
      VALUES (1, 'Bob', 'Local Hermes default agent at HERMES_HOME');
    `);
  }

  if (!tableExists(database, "skills")) {
    database.exec(`
      CREATE TABLE IF NOT EXISTS skills (
        skill_key       TEXT PRIMARY KEY,
        display_name    TEXT NOT NULL DEFAULT '',
        description     TEXT NOT NULL DEFAULT '',
        category        TEXT NOT NULL DEFAULT '',
        content         TEXT NOT NULL DEFAULT '',
        source          TEXT NOT NULL DEFAULT 'custom',
        synced_at       TEXT,
        sync_error      TEXT,
        created_at      TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_skills_category ON skills(category);
      CREATE INDEX IF NOT EXISTS idx_skills_source ON skills(source);
    `);
  }

  if (tableExists(database, "agent_profiles")) {
    if (!columnExists(database, "agent_profiles", "user_md")) {
      database.exec("ALTER TABLE agent_profiles ADD COLUMN user_md TEXT NOT NULL DEFAULT ''");
    }
    if (!columnExists(database, "agent_profiles", "memory_md")) {
      database.exec("ALTER TABLE agent_profiles ADD COLUMN memory_md TEXT NOT NULL DEFAULT ''");
    }
    if (!columnExists(database, "agent_profiles", "disabled_skills")) {
      database.exec(
        "ALTER TABLE agent_profiles ADD COLUMN disabled_skills TEXT NOT NULL DEFAULT '[]'",
      );
    }
    if (!columnExists(database, "agent_profiles", "platform_toolsets")) {
      database.exec(
        "ALTER TABLE agent_profiles ADD COLUMN platform_toolsets TEXT NOT NULL DEFAULT '{}'",
      );
    }
  }

  if (
    tableExists(database, "agent_root") &&
    !columnExists(database, "agent_root", "disabled_skills")
  ) {
    database.exec("ALTER TABLE agent_root ADD COLUMN disabled_skills TEXT NOT NULL DEFAULT '[]'");
  }
  if (
    tableExists(database, "agent_root") &&
    !columnExists(database, "agent_root", "platform_toolsets")
  ) {
    database.exec(
      "ALTER TABLE agent_root ADD COLUMN platform_toolsets TEXT NOT NULL DEFAULT '{}'",
    );
  }

  if (
    tableExists(database, "missions") &&
    !columnExists(database, "missions", "suggested_toolsets")
  ) {
    database.exec(
      "ALTER TABLE missions ADD COLUMN suggested_toolsets TEXT NOT NULL DEFAULT '[]'",
    );
  }

  if (
    tableExists(database, "catalog_templates") &&
    !columnExists(database, "catalog_templates", "suggested_toolsets")
  ) {
    database.exec(
      "ALTER TABLE catalog_templates ADD COLUMN suggested_toolsets TEXT NOT NULL DEFAULT '[]'",
    );
  }
}
