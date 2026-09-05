// ═══════════════════════════════════════════════════════════════
// db/upgrade.ts — Baseline rebuild + data import for legacy DBs
// ═══════════════════════════════════════════════════════════════

import type Database from "better-sqlite3";
import { spawnSync } from "child_process";
import {
  copyFileSync,
  existsSync,
  readdirSync,
  readFileSync,
  unlinkSync,
} from "fs";
import { dirname, join } from "path";
import { PATHS } from "../paths";
import { ensureDir } from "../fs/fs-helpers";

/** Squashed baseline schema, including profile/root/skills source-of-truth tables. */
export const BASELINE_SCHEMA_VERSION = 3;

const SCHEMA_VERSION_KEY = "schema_version";

/** Mission precedence: JSON files in PS_DATA_DIR/missions override SQLite export on same id. */
const MISSION_JSON_OVERLAY_WINS = true;

interface MissionRow {
  id: string;
  name: string;
  prompt: string;
  profile_id: string | null;
  status: string;
  result: string | null;
  session_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  local_dirs: string;
  references_: string;
  skills: string;
  goals: string;
  model_id: string | null;
  provider: string | null;
  profile_name: string | null;
  mission_time_minutes: number | null;
  timeout_minutes: number | null;
  schedule: string | null;
  cron_job_id: string | null;
  category_id?: string | null;
}

/** Tables preserved in FK-safe order (missions before sessions). */
const PRESERVE_TABLES = [
  "credentials",
  "models",
  "model_defaults",
  "model_fallbacks",
  "fallback_config",
  "missions",
  "cron_jobs",
  "sessions",
  "stories",
  "sync_registry",
  "gateway_platforms",
  "agent_profiles",
  "agent_root",
  "skills",
] as const;

function tableExists(database: Database.Database, name: string): boolean {
  const row = database
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
    .get(name) as { name: string } | undefined;
  return Boolean(row);
}

function getSchemaVersion(database: Database.Database): number {
  try {
    if (!tableExists(database, "meta")) return 0;
    const row = database
      .prepare("SELECT value FROM meta WHERE key = ?")
      .get(SCHEMA_VERSION_KEY) as { value: string } | undefined;
    return row ? parseInt(row.value, 10) : 0;
  } catch {
    return 0;
  }
}

function getTableColumns(database: Database.Database, tableName: string): string[] {
  if (!tableExists(database, tableName)) return [];
  const info = database.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  return info.map((c) => c.name);
}

function exportTableRows(
  database: Database.Database,
  tableName: string,
  options?: { excludeDeleted?: boolean }
): Record<string, unknown>[] {
  if (!tableExists(database, tableName)) return [];
  const cols = getTableColumns(database, tableName);
  if (cols.length === 0) return [];
  try {
    const hasDeleted = cols.includes("deleted_at") && options?.excludeDeleted !== false;
    const sql = hasDeleted
      ? `SELECT * FROM ${tableName} WHERE deleted_at IS NULL`
      : `SELECT * FROM ${tableName}`;
    return database.prepare(sql).all() as Record<string, unknown>[];
  } catch {
    return [];
  }
}

function importRows(
  database: Database.Database,
  tableName: string,
  rows: Record<string, unknown>[]
): void {
  if (rows.length === 0) return;
  const targetCols = getTableColumns(database, tableName);
  if (targetCols.length === 0) return;

  for (const row of rows) {
    const cols = targetCols.filter((c) => Object.prototype.hasOwnProperty.call(row, c));
    if (cols.length === 0) continue;
    const placeholders = cols.map(() => "?").join(", ");
    const sql = `INSERT OR REPLACE INTO ${tableName} (${cols.join(", ")}) VALUES (${placeholders})`;
    const values = cols.map((c) => row[c]);
    try {
      database.prepare(sql).run(...values);
    } catch {
      // skip rows that fail schema mismatch
    }
  }
}

function exportMissionsFromDb(database: Database.Database): MissionRow[] {
  return exportTableRows(database, "missions") as unknown as MissionRow[];
}

function missionsHasCategoryId(database: Database.Database): boolean {
  const cols = database
    .prepare("PRAGMA table_info(missions)")
    .all() as Array<{ name: string }>;
  return cols.some((c) => c.name === "category_id");
}

function importMissionRow(database: Database.Database, row: MissionRow): void {
  const baseValues = [
    row.id,
    row.name,
    row.prompt,
    row.profile_id ?? "default",
    row.status,
    row.result,
    row.session_id,
    row.created_at,
    row.updated_at,
    row.deleted_at,
    row.local_dirs ?? "[]",
    row.references_ ?? "[]",
    row.skills ?? "[]",
    row.goals ?? "[]",
    row.model_id,
    row.provider,
    row.profile_name,
    row.mission_time_minutes,
    row.timeout_minutes,
    row.schedule,
    row.cron_job_id,
  ];

  if (missionsHasCategoryId(database)) {
    database
      .prepare(
        `INSERT OR REPLACE INTO missions (
          id, name, prompt, profile_id, status, result, session_id,
          created_at, updated_at, deleted_at,
          local_dirs, references_, skills, goals,
          model_id, provider, profile_name,
          mission_time_minutes, timeout_minutes, schedule, cron_job_id, category_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(...baseValues, row.category_id ?? null);
    return;
  }

  database
    .prepare(
      `INSERT OR REPLACE INTO missions (
        id, name, prompt, profile_id, status, result, session_id,
        created_at, updated_at, deleted_at,
        local_dirs, references_, skills, goals,
        model_id, provider, profile_name,
        mission_time_minutes, timeout_minutes, schedule, cron_job_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(...baseValues);
}

function importMissionsFromJsonDir(database: Database.Database): number {
  const missionsDir = PATHS.missions;
  if (!existsSync(missionsDir)) return 0;

  let count = 0;
  for (const file of readdirSync(missionsDir)) {
    if (!file.endsWith(".json") || file.endsWith(".status.json")) continue;
    try {
      const raw = readFileSync(join(missionsDir, file), "utf-8");
      const m = JSON.parse(raw) as Record<string, unknown>;
      const id = String(m.id ?? file.replace(/\.json$/, ""));
      const statusRaw = String(m.status ?? "queued");
      const status =
        statusRaw === "pending"
          ? "queued"
          : statusRaw === "running"
            ? "dispatched"
            : statusRaw === "completed"
              ? "successful"
              : statusRaw === "cancelled"
                ? "failed"
                : statusRaw;

      importMissionRow(database, {
        id,
        name: String(m.name ?? id),
        prompt: String(m.prompt ?? ""),
        profile_id: (m.profileId ?? m.profile_id ?? "default") as string | null,
        status,
        result: (m.result as string) ?? null,
        session_id: (m.sessionId ?? m.session_id ?? null) as string | null,
        created_at: String(m.createdAt ?? m.created_at ?? new Date().toISOString()),
        updated_at: String(m.updatedAt ?? m.updated_at ?? new Date().toISOString()),
        deleted_at: null,
        local_dirs: JSON.stringify(m.localDirs ?? m.local_dirs ?? []),
        references_: JSON.stringify(m.references ?? m.references_ ?? []),
        skills: JSON.stringify(m.skills ?? []),
        goals: JSON.stringify(m.goals ?? []),
        model_id: (m.modelId ?? m.model_id ?? null) as string | null,
        provider: (m.provider as string) ?? null,
        profile_name: (m.profileName ?? m.profile_name ?? null) as string | null,
        mission_time_minutes: (m.missionTimeMinutes ?? m.mission_time_minutes ?? null) as number | null,
        timeout_minutes: (m.timeoutMinutes ?? m.timeout_minutes ?? null) as number | null,
        schedule: (m.schedule as string) ?? null,
        cron_job_id: (m.cronJobId ?? m.cron_job_id ?? null) as string | null,
      });
      count++;
    } catch {
      // skip corrupt mission files
    }
  }
  return count;
}

function runHermesRegistryImport(dbPath: string): void {
  const scriptPath = join(process.cwd(), "scripts", "tooling", "hermes-registry-import.mjs");
  if (!existsSync(scriptPath)) return;
  spawnSync(process.execPath, [scriptPath, dbPath], {
    stdio: "pipe",
    env: process.env,
  });
}

export interface BaselineExportSnapshot {
  missions: MissionRow[];
  tables: Record<string, Record<string, unknown>[]>;
}

/** Export all preserve-worthy data from a legacy database (for tests). */
export function exportLegacySnapshot(database: Database.Database): BaselineExportSnapshot {
  const tables: Record<string, Record<string, unknown>[]> = {};
  for (const name of PRESERVE_TABLES) {
    if (name === "missions") continue;
    tables[name] = exportTableRows(database, name);
  }
  return {
    missions: exportMissionsFromDb(database),
    tables,
  };
}

/**
 * Returns true when the open database is not on the squashed baseline schema.
 */
export function needsBaselineRebuild(database: Database.Database): boolean {
  const version = getSchemaVersion(database);
  return version > BASELINE_SCHEMA_VERSION + 100;
}

/**
 * Backup, recreate, apply baseline SQL, re-import preserved data, and run Hermes registry import.
 */
export function rebuildToBaseline(
  database: Database.Database,
  dbPath: string,
  baselineSql: string
): void {
  const snapshot = exportLegacySnapshot(database);
  database.close();

  const backupPath = `${dbPath}.pre-baseline-${Date.now()}`;
  if (existsSync(dbPath)) {
    copyFileSync(dbPath, backupPath);
    unlinkSync(dbPath);
    for (const suffix of ["-wal", "-shm"]) {
      const p = dbPath + suffix;
      if (existsSync(p)) unlinkSync(p);
    }
  }

  ensureDir(dirname(dbPath));

  // Real driver (avoids Jest mock when integration tests unmock better-sqlite3).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const BetterSqliteCtor = require("better-sqlite3/lib/index.js") as new (
    path: string
  ) => Database.Database;
  const fresh = new BetterSqliteCtor(dbPath);
  fresh.pragma("journal_mode = WAL");
  fresh.pragma("foreign_keys = ON");

  fresh.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  fresh.exec(baselineSql);

  const runImport = fresh.transaction(() => {
    for (const tableName of PRESERVE_TABLES) {
      if (tableName === "missions" || tableName === "sessions") continue;
      importRows(fresh, tableName, snapshot.tables[tableName] ?? []);
    }

    for (const row of snapshot.missions) {
      importMissionRow(fresh, row);
    }
    importRows(fresh, "sessions", snapshot.tables.sessions ?? []);

    if (MISSION_JSON_OVERLAY_WINS) {
      importMissionsFromJsonDir(fresh);
    }
  });
  runImport();

  fresh
    .prepare("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)")
    .run(SCHEMA_VERSION_KEY, String(BASELINE_SCHEMA_VERSION));

  fresh.close();

  runHermesRegistryImport(dbPath);
}
