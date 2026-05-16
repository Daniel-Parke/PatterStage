// ═══════════════════════════════════════════════════════════════
// db.ts — SQLite connection + migration runner
// Database: ~/control-hub/data/control-hub.db
// ═══════════════════════════════════════════════════════════════

import Database, { type Database as _DatabaseType } from "better-sqlite3";
import { join } from "path";
import { existsSync, mkdirSync, readFileSync, readdirSync } from "fs";
import { CH_DATA_DIR } from "./paths";

// ── Ensure data directory exists ───────────────────────────────

const dataDir = CH_DATA_DIR;
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

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

const SCHEMA_VERSION_KEY = "schema_version";

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

function runMigrations(database: Database.Database): void {
  // Ensure meta table exists first
  database.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const currentVersion = getSchemaVersion(database);
  const migrationsDir = join(__dirname, "db", "migrations");

  // Collect migration files
  const migrations: Array<{ num: number; sql: string }> = [];
  try {
    const files = readdirSync(migrationsDir)
      .filter((f: string) => f.endsWith(".sql"))
      .sort();
    for (const file of files) {
      const num = parseInt(file.split("_")[0], 10);
      if (!isNaN(num) && num > currentVersion) {
        const sql = readFileSync(join(migrationsDir, file), "utf-8");
        migrations.push({ num, sql });
      }
    }
  } catch {
    // No migrations dir — schema shipped via pre-baked DB
  }

  for (const { num, sql } of migrations) {
    database.exec(sql);
    setSchemaVersion(database, num);
  }
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
