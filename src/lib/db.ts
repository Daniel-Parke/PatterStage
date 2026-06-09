// ═══════════════════════════════════════════════════════════════
// db.ts — SQLite connection + migration runner
// Database: ~/control-hub/data/control-hub.db
// ═══════════════════════════════════════════════════════════════

import Database, { type Database as _DatabaseType } from "better-sqlite3";
import { join } from "path";
import { existsSync, readFileSync } from "fs";
import { CH_DATA_DIR } from "./paths";
import { getSchemaVersion, setSchemaVersion } from "./db-schema";
import { ensureDir } from "./fs-helpers";
import { needsBaselineRebuild, rebuildToBaseline } from "./db/upgrade";
import { applyProfilesToolsParityUpgrade } from "./db/apply-profiles-tools-upgrade";
import { applyMissionRepeatMigration } from "./db/apply-mission-repeat-migration";
import { applyMissionQueueMigration } from "./db/apply-mission-queue-migration";
import { applyCronScheduleCanonicalisation } from "./db/apply-cron-schedule-canonicalisation";

// ── Ensure data directory exists ───────────────────────────────

const dataDir = CH_DATA_DIR;
ensureDir(dataDir);

const DB_PATH = join(dataDir, "control-hub.db");

// ── Connection factory ─────────────────────────────────────────

let _db: Database.Database | null = null;

/** Open (or reuse) the SQLite database connection. Runs migrations on first open. */
export function getDb(): Database.Database {
  if (_db) return _db;

  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
  _db.pragma("busy_timeout = 5000");

  // Run migrations
  runMigrations(_db);

  return _db;
}

/** Alias — most code uses db() not getDb() */
export const db = getDb;

/** Result row from gateway_platforms table */
interface GatewayPlatformRow {
  platform: string;
  enabled: number;
  bot_token_present: number;
  last_synced_at: string;
}

/**
 * Read all gateway platform records from the DB.
 * Returns empty array if table doesn't exist or query fails.
 */
export function getGatewayPlatforms(): GatewayPlatformRow[] {
  try {
    return getDb()
      .prepare("SELECT platform, enabled, bot_token_present, last_synced_at FROM gateway_platforms")
      .all() as GatewayPlatformRow[];
  } catch {
    return [];
  }
}

// ── Shorthand helpers ─────────────────────────────────────────

/**
 * Wrap `fn` in a SQLite transaction. Commits on success, rolls back on throw.
 * shorthand for `db().transaction(fn)()`.
 */
export function inTransaction<T>(fn: () => T): T {
  const database = db();
  return database.transaction(fn)();
}

/** Generate a cryptographically random UUID v4 string. */
export function uuid(): string {
  return crypto.randomUUID();
}

/** Return the current UTC time as an ISO-8601 string. */
export function now(): string {
  return new Date().toISOString();
}

// ── Migration runner ───────────────────────────────────────────

const BASELINE_SCHEMA_VERSION = 3;

function tableExists(database: Database.Database, name: string): boolean {
  const row = database
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(name) as { name: string } | undefined;
  return Boolean(row);
}

function runMigrations(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const migrationsDir = join(__dirname, "db", "migrations");
  const baselinePath = join(migrationsDir, "001_baseline.sql");
  const baselineSql = existsSync(baselinePath)
    ? readFileSync(baselinePath, "utf-8")
    : "";

  const currentVersion = getSchemaVersion(database);
  const hasCoreSchema = tableExists(database, "missions") || tableExists(database, "agent_profiles");

  if (currentVersion === 0 && !hasCoreSchema && baselineSql) {
    database.exec(baselineSql);
    setSchemaVersion(database, BASELINE_SCHEMA_VERSION);
    return;
  }

  if (needsBaselineRebuild(database) && baselineSql) {
    rebuildToBaseline(database, DB_PATH, baselineSql);
    _db = null;
    _bootstrapped = false;
    const reopened = new Database(DB_PATH);
    reopened.pragma("journal_mode = WAL");
    reopened.pragma("foreign_keys = ON");
    reopened.pragma("busy_timeout = 5000");
    _db = reopened;
    return;
  }

  applyProfilesToolsParityUpgrade(database, migrationsDir);
  applyMissionRepeatMigration(database, migrationsDir);
  applyMissionQueueMigration(database, migrationsDir);
  applyCronScheduleCanonicalisation(database);
}

// ── Bootstrap: ensure DB + schema exist ───────────────────────
// Call this at module load time for API routes that need the DB
// immediately (before first query).

let _bootstrapped = false;

/**
 * Ensure the database is open and migrations have run.
 * Idempotent — safe to call multiple times.
 */
export function ensureDb(): void {
  if (_bootstrapped) return;
  _bootstrapped = true;
  db(); // forces open + migrate
}

export interface SchemaHealth {
  schemaVersion: number;
  hasMissionCategoriesTable: boolean;
  categoryCount: number;
}

/** Report schema version and mission_categories table state (after ensureDb). */
export function getSchemaHealth(): SchemaHealth {
  ensureDb();
  const database = getDb();
  const schemaVersion = getSchemaVersion(database);
  const tableRow = database
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'mission_categories'",
    )
    .get() as { name: string } | undefined;
  const hasMissionCategoriesTable = Boolean(tableRow);
  let categoryCount = 0;
  if (hasMissionCategoriesTable) {
    const row = database
      .prepare("SELECT COUNT(*) AS c FROM mission_categories")
      .get() as { c: number };
    categoryCount = row.c ?? 0;
  }
  if (schemaVersion >= 2 && !hasMissionCategoriesTable) {
    console.error(
      "[db] schema_version >= 2 but mission_categories table is missing — database may be corrupt",
    );
  }
  return { schemaVersion, hasMissionCategoriesTable, categoryCount };
}
