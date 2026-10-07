/** @jest-environment node */
// Synthetic degraded-v2 evidence does not establish real installed-upgrade acceptance.
import { readFileSync, mkdirSync, mkdtempSync, writeFileSync } from "fs";
import { spawnSync } from "child_process";
import { join } from "path";
import { migrationsDir, openRealDb, openBaselineDb, type RealDb } from "../helpers/baseline-db";
import { getSchemaVersion, setSchemaVersion } from "@/lib/db-schema";
import { applyAuthSessionsMigration, assertAuthSessionsSchema } from "@/lib/db/apply-auth-sessions-migration";
import { applyMissionRepeatMigration } from "@/lib/db/apply-mission-repeat-migration";
import { applyRunsSpendSourceMigration } from "@/lib/db/sql-migrations";
import type { runMigrations as runMigrationsExport } from "@/lib/db";
const { runMigrations } = jest.requireActual<{
  runMigrations: typeof runMigrationsExport;
}>("@/lib/db");

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
  const env = {
    ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(PS_|CH_|CONTROL_HUB_|NODE_OPTIONS$|NODE_PATH$)/i.test(key))),
    NODE_ENV: process.env.NODE_ENV,
  };
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

type Partial040 = "story only" | "spend only" | "both columns";
const partial040States: Partial040[] = ["story only", "spend only", "both columns"];
const runRows = (db: RealDb) => db.prepare("SELECT * FROM runs ORDER BY id").all() as Record<string, unknown>[];
function migrationData(db: RealDb) {
  return Object.fromEntries(["meta", "runs", "stories", "missions", "composer_workflows", "composer_nodes", "composer_runs", "composer_node_runs", "auth_sessions"]
    .filter((table) => tables(db).includes(table))
    .map((table) => [table, db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()]));
}
function expectExactStoryIndex(db: RealDb): void {
  const index = db.prepare("SELECT tbl_name, sql FROM sqlite_master WHERE type='index' AND name='idx_runs_story'").get() as { tbl_name: string; sql: string } | undefined;
  expect(index?.tbl_name).toBe("runs");
  expect(db.prepare("PRAGMA index_info(idx_runs_story)").all()).toEqual([expect.objectContaining({ seqno: 0, name: "story_id" })]);
  expect(db.prepare("PRAGMA index_list(runs)").all()).toEqual(expect.arrayContaining([
    expect.objectContaining({ name: "idx_runs_story", unique: 0, partial: 1 }),
  ]));
  const canonical = index?.sql.toLowerCase().replace(/["`\[\]]/g, "").replace(/\s+/g, " ")
    .replace(/\s*\(\s*/g, "(").replace(/\s*\)/g, ")").replace(/\bif not exists /, "").replace(/;$/, "").trim();
  expect(canonical).toBe("create index idx_runs_story on runs(story_id) where story_id is not null");
}
function pending040(state: Partial040): RealDb {
  const db = openRealDb();
  db.pragma("foreign_keys = ON");
  db.exec("CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
  db.exec(readFileSync(join(migrationsDir, "001_baseline.sql"), "utf8"));
  db.exec("ALTER TABLE runs ADD COLUMN composer_node_run_id TEXT");
  if (state !== "spend only") db.exec("ALTER TABLE runs ADD COLUMN story_id TEXT REFERENCES stories(id) ON DELETE SET NULL");
  if (state !== "story only") db.exec("ALTER TABLE runs ADD COLUMN spend_source TEXT NOT NULL DEFAULT 'agent' CHECK (spend_source IN ('agent','composer','research','story'))");
  db.prepare("INSERT INTO stories (id,title) VALUES ('oracle-story','Preserved story')").run();
  db.prepare("INSERT INTO missions (id,name,prompt) VALUES ('oracle-mission','Preserved mission','Preserved prompt')").run();
  const insert = db.prepare("INSERT INTO runs (id,mission_id,status,composer_node_run_id,usage_json,output,submitted_at,completed_at,updated_at) VALUES (?,'oracle-mission','completed',?,?,'Preserved output','2001-01-01','2001-01-02','2001-01-03')");
  insert.run("ordinary", null, ' {"inputTokens":13,"outputTokens":7,"totalTokens":0} ');
  insert.run("linked", "oracle-node-run", ' {"inputTokens":19,"outputTokens":3,"totalTokens":91} ');
  insert.run("damaged-usage", "oracle-other-node-run", " {unusable but preserved ");
  if (state !== "spend only") db.exec("UPDATE runs SET story_id='oracle-story' WHERE id='linked'");
  setSchemaVersion(db, 39);
  return db;
}

describe("T-0189 pending partial040 completion is atomic", () => {
  it.each(partial040States)("completes %s with historical backfill, exact index and preserved rows", (state) => {
    const db = pending040(state);
    try {
      const before = runRows(db);
      expect(applyRunsSpendSourceMigration(db, migrationsDir)).toBe(40);
      expect(getSchemaVersion(db)).toBe(40);
      expect(runRows(db)).toEqual(before.map((row) => ({ ...row,
        story_id: row.story_id ?? null,
        spend_source: row.composer_node_run_id === null ? "agent" : "composer",
      })));
      expectExactStoryIndex(db);
      expect(db.pragma("foreign_key_check")).toEqual([]);
      const completed = { schema: snapshot(db), data: migrationData(db) };
      expect(applyRunsSpendSourceMigration(db, migrationsDir)).toBe(40);
      expect({ schema: snapshot(db), data: migrationData(db) }).toEqual(completed);
    } finally { db.close(); }
  });
  it.each(partial040States.flatMap((state) => ["backfill", "version"].map((phase) => ({ state, phase }))))(
    "$state rolls back completion and version after injected $phase failure", ({ state, phase }) => {
      const db = pending040(state);
      try {
        if (phase === "backfill") {
          db.exec("CREATE TRIGGER oracle_040_backfill_failure AFTER UPDATE ON runs WHEN NEW.spend_source='composer' BEGIN SELECT RAISE(ABORT, 'oracle040 backfill failure'); END");
        } else {
          for (const operation of ["INSERT", "UPDATE"]) db.exec(`CREATE TRIGGER oracle_040_version_${operation.toLowerCase()} BEFORE ${operation} ON meta
            WHEN NEW.key='schema_version' AND CAST(NEW.value AS INTEGER)>=40 BEGIN SELECT RAISE(ABORT, 'oracle040 version failure'); END`);
        }
        const before = { schema: snapshot(db), data: migrationData(db) };
        expect(() => applyRunsSpendSourceMigration(db, migrationsDir)).toThrow(`oracle040 ${phase} failure`);
        expect(getSchemaVersion(db)).toBe(39);
        expect({ schema: snapshot(db), data: migrationData(db) }).toEqual(before);
      } finally { db.close(); }
    },
  );
  it("a pending conflicting index is retained with no false version completion", () => {
    const db = pending040("both columns");
    try {
      db.exec("CREATE INDEX idx_runs_story ON runs(mission_id)");
      const before = { schema: snapshot(db), data: migrationData(db) };
      expect(() => applyRunsSpendSourceMigration(db, migrationsDir)).toThrow(/idx_runs_story|index/i);
      expect({ schema: snapshot(db), data: migrationData(db) }).toEqual(before);
      expect(getSchemaVersion(db)).toBe(39);
    } finally { db.close(); }
  });
});

function populatedHead43(): RealDb {
  const db = fixture(false);
  runMigrations(db);
  expectExactStoryIndex(db);
  db.exec(`INSERT INTO stories (id,title) VALUES ('oracle-story','Preserved story');
    INSERT INTO missions (id,name,prompt) VALUES ('oracle-mission','Preserved mission','Preserved prompt');
    INSERT INTO composer_workflows (id,name) VALUES ('oracle-workflow','Preserved workflow');
    INSERT INTO composer_nodes (id,workflow_id,key,label) VALUES ('oracle-node','oracle-workflow','stage','Preserved node');
    INSERT INTO composer_runs (id,workflow_id) VALUES ('oracle-composer-run','oracle-workflow');
    INSERT INTO composer_node_runs (id,composer_run_id,node_id) VALUES ('oracle-node-run','oracle-composer-run','oracle-node')`);
  const insert = db.prepare("INSERT INTO runs (id,mission_id,status,composer_node_run_id,story_id,spend_source,usage_json,output) VALUES (?,'oracle-mission','completed',?,'oracle-story',?,?,'Preserved output')");
  for (const source of ["agent", "composer", "research", "story"]) {
    for (const linked of [false, true]) insert.run(`${source}-${linked}`, linked ? "oracle-node-run" : null, source,
      source === "research" ? " {unusable but preserved " : ' {"inputTokens":13,"outputTokens":7,"totalTokens":0} ');
  }
  db.exec("UPDATE composer_node_runs SET run_id='story-true' WHERE id='oracle-node-run'");
  db.prepare("INSERT INTO auth_sessions (id,secret_hash,created_at_ms,last_active_at_ms,idle_expires_at_ms,absolute_expires_at_ms,boot_generation,token_binding) VALUES ('oracle-auth',?,100,101,200,300,'oracle-boot',?)")
    .run(Buffer.alloc(32, 17), Buffer.alloc(32, 23));
  return db;
}

describe("T-0189 public head43 repair preserves recorded spending", () => {
  it("restores only the exact missing story index without replaying historical backfill", () => {
    const db = populatedHead43();
    try {
      expect(getSchemaVersion(db)).toBe(43);
      db.exec("DROP INDEX idx_runs_story");
      const beforeData = migrationData(db);
      const beforeColumns = columns(db);
      const beforeIndexes = indexes(db);
      const beforeSchema = db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name<>'idx_runs_story' ORDER BY type,name").all();
      runMigrations(db);
      expectExactStoryIndex(db);
      expect(getSchemaVersion(db)).toBe(43);
      expect(columns(db)).toEqual(beforeColumns);
      expect(indexes(db).filter((index) => index.name !== "idx_runs_story")).toEqual(beforeIndexes);
      expect(db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name<>'idx_runs_story' ORDER BY type,name").all()).toEqual(beforeSchema);
      expect(migrationData(db)).toEqual(beforeData);
      expect(() => assertAuthSessionsSchema(db)).not.toThrow();
      expect(applyAuthSessionsMigration(db, migrationsDir)).toBe(43);
      expect(db.pragma("foreign_key_check")).toEqual([]);
      const repaired = { schema: snapshot(db), data: migrationData(db) };
      runMigrations(db);
      runMigrations(db);
      expect({ schema: snapshot(db), data: migrationData(db) }).toEqual(repaired);
    } finally { db.close(); }
  });
  it.each([40, 43])("legacy applier at version %i is a no-op even with a missing index and SQL directory", (version) => {
    const db = populatedHead43();
    try {
      db.exec("DROP INDEX idx_runs_story");
      setSchemaVersion(db, version);
      const before = { schema: snapshot(db), data: migrationData(db) };
      expect(applyRunsSpendSourceMigration(db, join(migrationsDir, "absent-oracle-directory"))).toBe(version);
      expect({ schema: snapshot(db), data: migrationData(db) }).toEqual(before);
      expect(db.prepare("SELECT name FROM sqlite_master WHERE name='idx_runs_story'").get()).toBeUndefined();
    } finally { db.close(); }
  });
  it.each([
    { label: "wrong column", sql: "CREATE INDEX idx_runs_story ON runs(mission_id) WHERE story_id IS NOT NULL" },
    { label: "missing predicate", sql: "CREATE INDEX idx_runs_story ON runs(story_id)" },
    { label: "wrong predicate", sql: "CREATE INDEX idx_runs_story ON runs(story_id) WHERE story_id IS NULL" },
    { label: "wrong table", sql: "CREATE INDEX idx_runs_story ON missions(id) WHERE id IS NOT NULL" },
  ])("refuses a $label conflict without replacing its definition or changing rows", ({ sql }) => {
    const db = populatedHead43();
    try {
      db.exec("DROP INDEX idx_runs_story");
      db.exec(sql);
      const before = { schema: snapshot(db), data: migrationData(db) };
      expect(() => runMigrations(db)).toThrow(/idx_runs_story|index/i);
      expect({ schema: snapshot(db), data: migrationData(db) }).toEqual(before);
      expect(getSchemaVersion(db)).toBe(43);
      expect(() => assertAuthSessionsSchema(db)).not.toThrow();
    } finally { db.close(); }
  });
  it("index repair does not bypass public Auth43 validation", () => {
    const db = populatedHead43();
    try {
      db.exec("DROP INDEX idx_runs_story; ALTER TABLE auth_sessions RENAME COLUMN token_binding TO oracle_missing_binding");
      const beforeData = migrationData(db);
      expect(() => runMigrations(db)).toThrow(/auth_sessions|token_binding|schema/i);
      expect(getSchemaVersion(db)).toBe(43);
      expect(migrationData(db)).toEqual(beforeData);
    } finally { db.close(); }
  });
});

// Amendment 2026-10-02, Planck 01a0fd1f-516a-7323-af9c-0682d6bbbe6c:
// Add partial040 atomic completion and head43 index repair/preservation witnesses.
// Authorised by appended brief at 0cb62ae2; original and first amendment freezes retained.
