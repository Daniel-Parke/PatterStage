/** @jest-environment node */
// Synthetic historical fixtures are not evidence of a real installed upgrade.
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrationsDir, openRealDb, type RealDb } from "../helpers/baseline-db";
import { getSchemaVersion, setSchemaVersion } from "@/lib/db-schema";
import { applySqlMigration } from "@/lib/db/sql-migrations";
import { applyBenchmarkConfigMigration } from "@/lib/db/apply-benchmark-config-migration";
import { applyModelsApiStyleMigration } from "@/lib/db/apply-models-api-style-migration";
import { applyMemoryProvidersMigration } from "@/lib/db/apply-memory-providers-migration";
import { applyFrameworksMigration } from "@/lib/db/apply-frameworks-migration";
import { applyComposerRejectedMigration } from "@/lib/db/apply-composer-rejected-migration";
import { applyComposerNodeCancelledMigration } from "@/lib/db/apply-composer-node-cancelled-migration";
import { applyAuthSessionsMigration } from "@/lib/db/apply-auth-sessions-migration";

const { runMigrations } = jest.requireActual<typeof import("@/lib/db")>("@/lib/db");
const executedSql = new WeakMap<RealDb, string[]>();
function tracedDb(): RealDb {
  const statements: string[] = [];
  const Database = jest.requireActual(join(process.cwd(), "node_modules", "better-sqlite3", "lib", "index.js")) as
    new (path: string, options: { verbose: (statement: string) => void }) => RealDb;
  const db = new Database(":memory:", { verbose: (statement) => statements.push(statement) });
  executedSql.set(db, statements);
  return db;
}
const sql = (file: string): string => readFileSync(join(migrationsDir, file), "utf8");
const columns = (db: RealDb, table: string): string[] =>
  (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((row) => row.name);
const tables = (db: RealDb): string[] =>
  (db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as { name: string }[])
    .map((row) => row.name);

function base(): RealDb {
  const db = tracedDb();
  db.exec("CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
  db.exec(sql("001_baseline.sql"));
  setSchemaVersion(db, 3);
  return db;
}
function add(db: RealDb, table: string, column: string, declaration: string): void {
  if (!columns(db, table).includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${declaration}`);
}

/** Independent history: SQL files plus the guarded additions declared by marker SQL. */
function prior(version: number): RealDb {
  const db = base();
  try {
    for (const file of readdirSync(migrationsDir).filter((name) => /^\d{3}_.*\.sql$/.test(name)).sort()) {
      const step = Number(file.slice(0, 3));
      if (step <= 3 || step > version) continue;
      if (step === 5) { add(db, "cron_jobs", "workdir", "TEXT NOT NULL DEFAULT ''"); continue; }
      if (step === 6) { add(db, "sessions", "message_count", "INTEGER NOT NULL DEFAULT 0"); continue; }
      if (step === 35 || step === 37) db.pragma("foreign_keys = OFF");
      db.exec(sql(file));
      if (step === 35 || step === 37) db.pragma("foreign_keys = ON");
      if (step === 17) add(db, "benchmark_item_results", "metrics_json", "TEXT");
      if (step === 18) {
        add(db, "missions", "version", "TEXT NOT NULL DEFAULT 'v1'");
        add(db, "missions", "current_phase_id", "TEXT");
        add(db, "runs", "phase_action_id", "TEXT");
      }
      if (step === 20) {
        db.exec("ALTER TABLE missions DROP COLUMN version; ALTER TABLE missions DROP COLUMN current_phase_id; ALTER TABLE runs DROP COLUMN phase_action_id");
      }
      if (step === 21) add(db, "runs", "composer_node_run_id", "TEXT");
      if (step === 23) add(db, "research_runs", "config_json", "TEXT");
      if (step === 24) add(db, "models", "api_style", "TEXT");
      if (step === 25) add(db, "research_runs", "composer_node_run_id", "TEXT");
      if (step === 26) add(db, "composer_runs", "parent_node_run_id", "TEXT");
    }
    setSchemaVersion(db, version);
    return db;
  } catch (error) {
    db.close();
    throw new Error(`INFRASTRUCTURE: independent v${version} fixture failed: ${String(error)}`);
  }
}
function snapshot(db: RealDb): unknown {
  return {
    schema: db.prepare("SELECT type, name, tbl_name, sql FROM sqlite_master ORDER BY type, name").all(),
    rows: tables(db).map((table) => ({ table, rows: db.prepare(`SELECT * FROM "${table}" ORDER BY rowid`).all() })),
  };
}
function withDirectory(body: (directory: string) => void): void {
  const directory = mkdtempSync(join(tmpdir(), "t0188-owned-sql-"));
  try { body(directory); } finally { rmSync(directory, { recursive: true, force: true }); }
}

describe("T-0188 convergence and pending failures (real SQLite)", () => {
  it("a genuinely empty database reaches literal 43 in one call and stays stable", () => {
    const db = openRealDb();
    try {
      db.pragma("foreign_keys = ON");
      expect(tables(db)).toEqual([]);
      runMigrations(db);
      expect(getSchemaVersion(db)).toBe(43);
      expect(tables(db)).toEqual(expect.arrayContaining([
        "benchmark_runs", "composer_workflows", "composer_node_runs", "research_runs", "auth_sessions",
      ]));
      expect(columns(db, "runs")).toEqual(expect.arrayContaining(["composer_node_run_id", "spend_source", "story_id"]));
      expect(columns(db, "models")).toEqual(expect.arrayContaining(["api_style", "origin"]));
      const before = snapshot(db);
      runMigrations(db);
      runMigrations(db);
      expect(snapshot(db)).toEqual(before);
    } finally { db.close(); }
  });

  it.each([3, 14, 23, 34, 36, 42])("synthetic supported v%i converges once without changing user fields", (version) => {
    const db = prior(version);
    try {
      db.prepare("INSERT INTO missions (id,name,prompt,status,created_at,updated_at) VALUES ('m-owned','User mission','Keep all fields','successful','2000-01-01','2000-01-02')").run();
      db.prepare("INSERT INTO cron_jobs (id,name,schedule,source,created_at,updated_at) VALUES ('c-owned','User cron','0 0 * * *','user','2000-01-01','2000-01-02')").run();
      const projected = ["missions", "cron_jobs"].map((table) => ({
        table, names: columns(db, table), rows: db.prepare(`SELECT * FROM ${table} ORDER BY id`).all(),
      }));
      runMigrations(db);
      expect(getSchemaVersion(db)).toBe(43);
      for (const record of projected) {
        const names = record.names.map((name) => `"${name === "hermes_job_id" ? "external_job_id" : name}"`).join(",");
        const actual = db.prepare(`SELECT ${names} FROM ${record.table} ORDER BY id`).all() as Record<string, unknown>[];
        const expected = (record.rows as Record<string, unknown>[]).map((row) => Object.fromEntries(
          Object.entries(row).map(([key, value]) => [key === "hermes_job_id" ? "external_job_id" : key, value]),
        ));
        expect(actual).toEqual(expected);
      }
      expect(db.pragma("foreign_key_check")).toEqual([]);
      const migrated = snapshot(db);
      runMigrations(db);
      runMigrations(db);
      expect(snapshot(db)).toEqual(migrated);
    } finally { db.close(); }
  });

  it.each(["benchmark_runs", "benchmark_item_results"])("pending v15 rejects missing %s without completing step 15", (missing) => {
    const db = prior(14);
    try {
      db.exec(`DROP TABLE ${missing}`);
      db.prepare("INSERT INTO missions (id,name,prompt) VALUES ('keep','Keep','unchanged')").run();
      expect(() => applyBenchmarkConfigMigration(db, migrationsDir)).toThrow();
      expect(getSchemaVersion(db)).toBe(14);
      expect(db.prepare("SELECT prompt FROM missions WHERE id='keep'").get()).toEqual({ prompt: "unchanged" });
    } finally { db.close(); }
  });

  it("pending v15 fills remaining columns on both partially additive tables", () => {
    const db = prior(14);
    try {
      db.exec("ALTER TABLE benchmark_runs ADD COLUMN model_id TEXT; ALTER TABLE benchmark_runs ADD COLUMN used_tools INTEGER; ALTER TABLE benchmark_item_results ADD COLUMN tools_used_json TEXT");
      db.prepare("INSERT INTO benchmark_runs (id,suite_key,suite_version,target_kind,target_ref,model_id,used_tools) VALUES ('b','s','1','model','m','user-model',1)").run();
      db.prepare("INSERT INTO benchmark_item_results (id,benchmark_run_id,item_id,domain,tools_used_json) VALUES ('i','b','q','test','[\"user-tool\"]')").run();
      expect(applyBenchmarkConfigMigration(db, migrationsDir)).toBe(15);
      expect(columns(db, "benchmark_runs")).toEqual(expect.arrayContaining([
        "model_id", "model_label", "exec_mode", "used_skills", "used_tools", "used_memory", "config_json",
      ]));
      expect(columns(db, "benchmark_item_results")).toEqual(expect.arrayContaining([
        "skills_used_json", "tools_used_json", "memory_used",
      ]));
      expect(db.prepare("SELECT model_id,used_tools FROM benchmark_runs WHERE id='b'").get())
        .toEqual({ model_id: "user-model", used_tools: 1 });
      expect(db.prepare("SELECT tools_used_json FROM benchmark_item_results WHERE id='i'").get())
        .toEqual({ tools_used_json: '["user-tool"]' });
      const before = snapshot(db);
      expect(applyBenchmarkConfigMigration(db, migrationsDir)).toBe(15);
      expect(snapshot(db)).toEqual(before);
    } finally { db.close(); }
  });

  it.each(["missing", "broken"])("a %s pending SQL migration cannot advance its version", (kind) => {
    withDirectory((directory) => {
      const db = prior(11);
      try {
        if (kind === "broken") writeFileSync(join(directory, "012_analytics_events.sql"), "THIS IS NOT SQL;\n");
        expect(() => applySqlMigration(db, directory, 12)).toThrow();
        expect(getSchemaVersion(db)).toBe(11);
        expect(tables(db)).not.toContain("analytics_events");
      } finally { db.close(); }
    });
  });
});

describe("T-0188 repairs and empty-only seeds (real SQLite)", () => {
  it("repairs NULL styles but preserves explicit styles contrary to inference", () => {
    const db = base();
    try {
      db.exec("ALTER TABLE models ADD COLUMN api_style TEXT");
      const insert = db.prepare("INSERT INTO models (id,name,provider,model_id,base_url,api_style) VALUES (?,?,?,?,?,?)");
      insert.run("explicit-openai", "User A", "anthropic", "a", "https://api.anthropic.com", "openai");
      insert.run("explicit-anthropic", "User B", "openai", "b", "https://api.openai.com/v1", "anthropic");
      insert.run("null-minimax", "User C", "minimax", "c", "https://api.minimax.io/anthropic", null);
      insert.run("null-openai", "User D", "openai", "d", "https://api.openai.com/v1", null);
      insert.run("null-anthropic", "User E", "anthropic", "e", "https://api.anthropic.com", null);
      const userFields = db.prepare("SELECT id,name,provider,model_id,base_url FROM models ORDER BY id").all();
      setSchemaVersion(db, 23);
      expect(applyModelsApiStyleMigration(db, migrationsDir)).toBe(24);
      expect(db.prepare("SELECT id,api_style FROM models ORDER BY id").all()).toEqual([
        { id: "explicit-anthropic", api_style: "anthropic" }, { id: "explicit-openai", api_style: "openai" },
        { id: "null-anthropic", api_style: "anthropic" }, { id: "null-minimax", api_style: "anthropic" },
        { id: "null-openai", api_style: "openai" },
      ]);
      expect(db.prepare("SELECT id,name,provider,model_id,base_url FROM models ORDER BY id").all()).toEqual(userFields);
      const before = snapshot(db);
      applyModelsApiStyleMigration(db, migrationsDir);
      expect(snapshot(db)).toEqual(before);
    } finally { db.close(); }
  });

  it.each([
    { table: "memory_providers", file: "022_memory_providers.sql", version: 22, apply: applyMemoryProvidersMigration, seed: "hindsight", label: "label" },
    { table: "frameworks", file: "027_frameworks.sql", version: 27, apply: applyFrameworksMigration, seed: "hermes", label: "name" },
  ])("$table seeds only empty storage and preserves custom-only storage", (fixture) => {
    for (const populated of [false, true]) {
      const db = openRealDb();
      try {
        db.exec("CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
        db.exec(sql(fixture.file));
        if (populated) db.prepare(`INSERT INTO ${fixture.table} (type,${fixture.label},enabled,is_active,config_json,created_at,updated_at) VALUES ('custom','User choice',1,1,'{"owned":true}','2000-01-01','2000-01-02')`).run();
        const before = db.prepare(`SELECT * FROM ${fixture.table} ORDER BY id`).all();
        setSchemaVersion(db, fixture.version - 1);
        expect(fixture.apply(db, migrationsDir)).toBe(fixture.version);
        if (populated) expect(db.prepare(`SELECT * FROM ${fixture.table} ORDER BY id`).all()).toEqual(before);
        else {
          expect(db.prepare(`SELECT type,enabled,is_active FROM ${fixture.table}`).all())
            .toEqual([{ type: fixture.seed, enabled: 1, is_active: 1 }]);
        }
        const seeded = snapshot(db);
        fixture.apply(db, migrationsDir);
        expect(snapshot(db)).toEqual(seeded);
      } finally { db.close(); }
    }
  });
});

const rebuilds = [
  { version: 35, apply: applyComposerRejectedMigration, status: "rejected", targets: ["composer_runs", "composer_node_runs"] },
  { version: 37, apply: applyComposerNodeCancelledMigration, status: "cancelled", targets: ["composer_node_runs"] },
];
function composer(version: number, fk: number): RealDb {
  const db = base();
  db.exec(sql("021_composer.sql"));
  db.exec("ALTER TABLE composer_runs ADD COLUMN parent_node_run_id TEXT");
  if (version === 37) {
    db.pragma("foreign_keys = OFF");
    db.exec(sql("035_composer_rejected.sql"));
  }
  db.pragma("foreign_keys = ON");
  db.exec("INSERT INTO composer_workflows (id,name) VALUES ('w','Owned workflow'); INSERT INTO composer_nodes (id,workflow_id,key,label) VALUES ('n','w','key','Owned node'); INSERT INTO runs (id,status,output) VALUES ('agent','completed','agent output')");
  db.prepare("INSERT INTO composer_runs (id,workflow_id,status,current_node_id,input,context_json,profile_name,error,created_at,updated_at,completed_at,parent_node_run_id) VALUES ('r','w','completed','n','input','{}','user-profile',NULL,'2000-01-01','2000-01-02','2000-01-03',NULL)").run();
  db.prepare("INSERT INTO composer_node_runs (id,composer_run_id,node_id,attempt,status,run_id,input,output,verdict_json,error,started_at,completed_at,created_at) VALUES ('nr','r','n',2,'completed','agent','node input','node output',?,NULL,'2000-01-01','2000-01-02','2000-01-03')").run('{"pass":true}');
  db.exec("INSERT INTO composer_approvals (id,composer_run_id,node_id,action,approved,note) VALUES ('approval','r','n','accept',1,'User approval')");
  setSchemaVersion(db, version - 1);
  db.pragma(`foreign_keys = ${fk ? "ON" : "OFF"}`);
  return db;
}
function composerRows(db: RealDb): unknown {
  return ["composer_runs", "composer_node_runs", "composer_approvals", "runs"].map((table) => ({
    table, rows: db.prepare(`SELECT * FROM ${table} ORDER BY id`).all(),
  }));
}

describe.each(rebuilds)("T-0188 rebuild $version (real SQLite)", (rebuild) => {
  it.each([0, 1])("preserves exact rows, constraints, indexes and incoming FK=%i", (fk) => {
    const db = composer(rebuild.version, fk);
    try {
      const before = composerRows(db);
      const shape = rebuild.targets.map((table) => ({ table, columns: db.prepare(`PRAGMA table_info(${table})`).all() }));
      expect(() => db.prepare("UPDATE composer_node_runs SET status=? WHERE id='nr'").run(rebuild.status))
        .toThrow(/CHECK/);
      expect(rebuild.apply(db, migrationsDir)).toBe(rebuild.version);
      expect(getSchemaVersion(db)).toBe(rebuild.version);
      expect(composerRows(db)).toEqual(before);
      for (const target of shape) expect(db.prepare(`PRAGMA table_info(${target.table})`).all()).toEqual(target.columns);
      expect(db.pragma("foreign_keys", { simple: true })).toBe(fk);
      expect(db.inTransaction).toBe(false);
      expect(db.pragma("foreign_key_check")).toEqual([]);
      expect(db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name IN ('idx_composer_runs_active','idx_composer_node_runs_run') ORDER BY name").all())
        .toEqual([{ name: "idx_composer_node_runs_run" }, { name: "idx_composer_runs_active" }]);
      db.prepare("UPDATE composer_node_runs SET status=? WHERE id='nr'").run(rebuild.status);
      expect(() => db.exec("UPDATE composer_node_runs SET status='invalid-status' WHERE id='nr'"))
        .toThrow(/CHECK/);
      db.pragma("foreign_keys = ON");
      expect(() => db.exec("INSERT INTO composer_node_runs (id,composer_run_id,node_id) VALUES ('orphan','absent','n')"))
        .toThrow(/FOREIGN KEY/);
      db.exec("DELETE FROM composer_runs WHERE id='r'");
      expect(db.prepare("SELECT id FROM composer_node_runs").all()).toEqual([]);
      expect(db.prepare("SELECT id FROM composer_approvals").all()).toEqual([]);
    } finally { db.close(); }
  });

  it.each([0, 1])("rejects every missing/extra target shape before drops and restores FK=%i", (fk) => {
    for (const target of rebuild.targets) for (const damage of ["missing", "extra"]) {
      const db = composer(rebuild.version, fk);
      try {
        db.exec(damage === "extra" ? `ALTER TABLE ${target} ADD COLUMN user_extra TEXT` : `ALTER TABLE ${target} DROP COLUMN error`);
        const before = snapshot(db);
        const statements = executedSql.get(db)!;
        const start = statements.length;
        expect(() => rebuild.apply(db, migrationsDir)).toThrow(/drift|shape|column/i);
        expect(statements.slice(start).filter((statement) => /\bDROP\s+TABLE\b/i.test(statement))).toEqual([]);
        expect(getSchemaVersion(db)).toBe(rebuild.version - 1);
        expect(snapshot(db)).toEqual(before);
        expect(db.pragma("foreign_keys", { simple: true })).toBe(fk);
        expect(db.inTransaction).toBe(false);
      } finally { db.close(); }
    }
  });

  it.each([0, 1])("a real SQL failure after destructive work rolls back only this rebuild, FK=%i", (fk) => {
    withDirectory((directory) => {
      const db = composer(rebuild.version, fk);
      const file = rebuild.version === 35 ? "035_composer_rejected.sql" : "037_composer_node_cancelled.sql";
      // Execute real historical rebuild SQL, then a deterministic engine error before commit.
      writeFileSync(join(directory, file), sql(file) + "\nINSERT INTO t0188_deliberately_absent VALUES (1);\n");
      try {
        const before = snapshot(db);
        expect(() => rebuild.apply(db, directory)).toThrow(/t0188_deliberately_absent/);
        expect(snapshot(db)).toEqual(before);
        expect(getSchemaVersion(db)).toBe(rebuild.version - 1);
        expect(db.pragma("foreign_keys", { simple: true })).toBe(fk);
        expect(db.inTransaction).toBe(false);
        expect(db.prepare("SELECT 1 AS usable").get()).toEqual({ usable: 1 });
      } finally { db.close(); }
    });
  });
});

describe("T-0188 Auth43 mandatory storage validation (real SQLite)", () => {
  it.each([42, 43])("valid Auth43 storage is stable from recorded version %i", (version) => {
    const db = openRealDb();
    try {
      db.exec("CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
      db.exec(sql("043_auth_sessions.sql"));
      db.prepare("INSERT INTO auth_sessions (id,secret_hash,created_at_ms,last_active_at_ms,idle_expires_at_ms,absolute_expires_at_ms,boot_generation,token_binding) VALUES (?,?,1,2,3,4,'owned-generation',?)")
        .run("owned-auth", Buffer.alloc(32, 1), Buffer.alloc(32, 2));
      setSchemaVersion(db, version);
      const rows = db.prepare("SELECT * FROM auth_sessions").all();
      expect(applyAuthSessionsMigration(db, migrationsDir)).toBe(43);
      expect(getSchemaVersion(db)).toBe(43);
      expect(db.prepare("SELECT * FROM auth_sessions").all()).toEqual(rows);
      const before = snapshot(db);
      applyAuthSessionsMigration(db, migrationsDir);
      expect(snapshot(db)).toEqual(before);
    } finally { db.close(); }
  });

  it.each([42, 43])("malformed actual auth storage fails even with recorded version %i", (version) => {
    const db = openRealDb();
    try {
      db.exec("CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL); CREATE TABLE auth_sessions (id TEXT PRIMARY KEY, user_payload TEXT)");
      db.exec("INSERT INTO auth_sessions VALUES ('keep','owned payload')");
      setSchemaVersion(db, version);
      const before = snapshot(db);
      expect(() => applyAuthSessionsMigration(db, migrationsDir)).toThrow(/auth_sessions|shape|column/i);
      expect(getSchemaVersion(db)).toBe(version);
      expect(snapshot(db)).toEqual(before);
    } finally { db.close(); }
  });
});
