/** @jest-environment node */
// Synthetic degraded-v2 evidence does not establish real installed-upgrade acceptance.
import { readFileSync, mkdirSync, mkdtempSync, writeFileSync } from "fs";
import { spawnSync } from "child_process";
import { join } from "path";
import { migrationsDir, openRealDb, openBaselineDb, type RealDb } from "../helpers/baseline-db";
import { getSchemaVersion, setSchemaVersion } from "@/lib/db-schema";
import { applyAuthSessionsMigration } from "@/lib/db/apply-auth-sessions-migration";
import { applyMissionRepeatMigration } from "@/lib/db/apply-mission-repeat-migration";
const { runMigrations } = jest.requireActual<typeof import("@/lib/db")>("@/lib/db");

function fixture(degraded: boolean): RealDb {
  const db = openRealDb();
  db.pragma("foreign_keys = ON");
  if (degraded) {
    db.exec("CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
    db.exec(readFileSync(join(migrationsDir, "001_baseline.sql"), "utf8"));
    db.pragma("foreign_keys = OFF");
    db.exec("ALTER TABLE cron_jobs DROP COLUMN workdir; DROP TABLE runs; DROP TABLE schedules");
    db.pragma("foreign_keys = ON");
    setSchemaVersion(db, 2);
  }
  return db;
}
const tables = (db: RealDb) => (db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as { name: string }[]).map((row) => row.name);
function columns(db: RealDb) {
  return Object.fromEntries(tables(db).map((table) => [table,
    (db.prepare(`PRAGMA table_info("${table}")`).all() as { cid: number; name: string }[])
      .map(({ cid: _cid, ...definition }) => definition).sort((a, b) => a.name.localeCompare(b.name)),
  ]));
}
function indexes(db: RealDb) {
  const rows = db.prepare("SELECT name, tbl_name, sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL ORDER BY name").all() as { name: string; tbl_name: string; sql: string }[];
  // Formatting differences in sqlite_master are not schema differences.
  return rows.map((row) => ({ ...row, sql: row.sql.replace(/\s+/g, " ").trim() }));
}
function snapshot(db: RealDb) {
  return { version: getSchemaVersion(db), tables: tables(db), columns: columns(db), indexes: indexes(db),
    schema: db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master ORDER BY type,name").all() };
}

describe("T-0189 fresh and degraded-v2 migration parity", () => {
  it.each(["tables", "columns", "indexes"])("one migration pass produces equal final %s", (surface) => {
    const fresh = fixture(false);
    const degraded = fixture(true);
    try {
      runMigrations(fresh);
      runMigrations(degraded);
      expect(getSchemaVersion(fresh)).toBe(43);
      expect(getSchemaVersion(degraded)).toBe(43);
      const observe = surface === "tables" ? tables : surface === "columns" ? columns : indexes;
      expect(observe(degraded)).toEqual(observe(fresh));
    } finally { fresh.close(); degraded.close(); }
  });
  it.each([false, true])("degraded=%s creates idx_runs_story on the first pass and preserves head43/Auth43", (degraded) => {
    const db = fixture(degraded);
    try {
      runMigrations(db);
      expect(getSchemaVersion(db)).toBe(43);
      expect(applyAuthSessionsMigration(db, migrationsDir)).toBe(43);
      expect(tables(db)).toContain("auth_sessions");
      expect(db.prepare("SELECT tbl_name FROM sqlite_master WHERE type='index' AND name='idx_runs_story'").get()).toEqual({ tbl_name: "runs" });
      expect(db.prepare("PRAGMA index_info(idx_runs_story)").all()).toEqual([expect.objectContaining({ name: "story_id" })]);
      expect(db.pragma("foreign_key_check")).toEqual([]);
    } finally { db.close(); }
  });
  it.each([false, true])("degraded=%s remains stable on repeated migration calls", (degraded) => {
    const db = fixture(degraded);
    try {
      runMigrations(db);
      const before = snapshot(db);
      runMigrations(db);
      runMigrations(db);
      expect(snapshot(db)).toEqual(before);
    } finally { db.close(); }
  });
});

describe("T-0189 mission-repeat public version contract", () => {
  it.each([4, 43])("already applied version %i is a no-op even without old SQL files", (version) => {
    const db = openBaselineDb();
    try {
      setSchemaVersion(db, version);
      const before = snapshot(db);
      expect(applyMissionRepeatMigration(db, join(migrationsDir, "absent-oracle-directory"))).toBe(version);
      expect(snapshot(db)).toEqual(before);
    } finally { db.close(); }
  });
  it("a pending migration returns four and repeat application changes nothing", () => {
    const db = openBaselineDb();
    try {
      expect(getSchemaVersion(db)).toBe(3);
      expect(applyMissionRepeatMigration(db, migrationsDir)).toBe(4);
      const before = snapshot(db);
      expect(applyMissionRepeatMigration(db, migrationsDir)).toBe(4);
      expect(snapshot(db)).toEqual(before);
    } finally { db.close(); }
  });
  it("a SQLite error while recording the version is propagated and cannot mark the step complete", () => {
    const db = openBaselineDb();
    try {
      db.exec("CREATE TRIGGER oracle_version_failure BEFORE INSERT ON meta WHEN NEW.key='schema_version' BEGIN SELECT RAISE(ABORT, 'oracle version failure'); END");
      expect(() => applyMissionRepeatMigration(db, migrationsDir)).toThrow(/oracle version failure/);
      expect(getSchemaVersion(db)).toBe(3);
    } finally { db.close(); }
  });
});

function cliFixture() {
  const parent = join(process.cwd(), "tmp", "t0189-cli-fixtures");
  mkdirSync(parent, { recursive: true });
  const root = mkdtempSync(join(parent, "case-"));
  for (const name of ["data", "hermes", "home", "temp"]) mkdirSync(join(root, name));
  return root;
}
function migrateCli(root: string, data = join(root, "data")) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(PS_|CH_|CONTROL_HUB_|NODE_OPTIONS$|NODE_PATH$)/i.test(key)));
  Object.assign(env, { PS_DATA_DIR: data, CH_DATA_DIR: data, CONTROL_HUB_DATA_DIR: data,
    HERMES_HOME: join(root, "hermes"), HOME: join(root, "home"), USERPROFILE: join(root, "home"),
    TMP: join(root, "temp"), TEMP: join(root, "temp"), TMPDIR: join(root, "temp") });
  const result = spawnSync(process.execPath, [join(process.cwd(), "node_modules/tsx/dist/cli.mjs"), "scripts/tooling/migrate-db.ts"], {
    cwd: process.cwd(), env, timeout: 20000, encoding: "utf8", windowsHide: true,
  });
  const prefix = join(root, `cli-${Date.now()}`);
  writeFileSync(prefix + ".stdout.log", result.stdout ?? "");
  writeFileSync(prefix + ".stderr.log", result.stderr ?? "");
  if (result.error) throw new Error(`INFRASTRUCTURE: CLI launch failed: ${String(result.error)}`);
  if (/uv_os_get_passwd|ERR_MODULE_NOT_FOUND|Cannot find (module|package)/.test(result.stderr ?? "")) {
    throw new Error(`INFRASTRUCTURE: CLI runtime failed before migration: ${result.stderr}`);
  }
  return result;
}

describe("T-0189 actual migration CLI", () => {
  it("one fresh invocation reaches head43 and a repeat preserves existing data", () => {
    const root = cliFixture();
    const first = migrateCli(root);
    expect({ exitCode: first.status, stderr: first.stderr }).toEqual({ exitCode: 0, stderr: expect.any(String) });
    const Database = jest.requireActual(join(process.cwd(), "node_modules/better-sqlite3/lib/index.js")) as new (path: string) => RealDb;
    const file = join(root, "data", "patterstage.db");
    let db = new Database(file);
    let before: ReturnType<typeof snapshot>;
    try {
      expect(getSchemaVersion(db)).toBe(43);
      expect(tables(db)).toContain("auth_sessions");
      db.prepare("INSERT INTO missions (id,name,prompt) VALUES ('oracle','User mission','Keep this prompt')").run();
      before = snapshot(db);
    } finally { db.close(); }
    expect(migrateCli(root).status).toBe(0);
    db = new Database(file);
    try {
      expect(snapshot(db)).toEqual(before);
      expect(db.prepare("SELECT prompt FROM missions WHERE id='oracle'").get()).toEqual({ prompt: "Keep this prompt" });
    } finally { db.close(); }
  }, 45000);
  it("an unusable owned data directory retains a nonzero failure exit", () => {
    const root = cliFixture();
    const file = join(root, "not-a-directory");
    writeFileSync(file, "preserved sentinel");
    const result = migrateCli(root, file);
    expect(result.status).not.toBeNull();
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/ENOTDIR|EEXIST|not a directory|SQLITE_CANTOPEN|unable to open database file/i);
    expect(readFileSync(file, "utf8")).toBe("preserved sentinel");
  }, 25000);
});
