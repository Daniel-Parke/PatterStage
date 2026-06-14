// Verifies the Phase 2 schema against REAL SQLite (the global better-sqlite3
// mock is bypassed via requireActual). Covers: baseline provisioning, the 009
// upgrade path for older DBs (+ idempotency), and the CHECK constraints.

import { readFileSync } from "fs";
import { join } from "path";
import type DatabaseNs from "better-sqlite3";
import { applyRunsSchedulesMigration } from "@/lib/db/apply-runs-schedules-migration";
import { getSchemaVersion } from "@/lib/db-schema";

type RealDb = DatabaseNs.Database;

// jest.config maps "better-sqlite3" to a mock (even through requireActual), so
// load the REAL native module by its on-disk path to bypass the name mapper.
const Database = jest.requireActual(
  join(process.cwd(), "node_modules", "better-sqlite3", "lib", "index.js"),
) as unknown as new (path: string) => RealDb;

const migrationsDir = join(process.cwd(), "src", "lib", "db", "migrations");

function cols(db: RealDb, table: string): string[] {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((r) => r.name);
}
function tableNames(db: RealDb): string[] {
  return (
    db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]
  ).map((r) => r.name);
}
function withMeta(db: RealDb): RealDb {
  db.pragma("foreign_keys = ON");
  db.exec("CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);");
  return db;
}

describe("runs/schedules schema (real SQLite)", () => {
  it("baseline provisions runs + schedules tables and the new columns", () => {
    const db = withMeta(new Database(":memory:"));
    db.exec(readFileSync(join(migrationsDir, "001_baseline.sql"), "utf-8"));

    expect(tableNames(db)).toEqual(expect.arrayContaining(["runs", "schedules"]));
    expect(cols(db, "runs")).toEqual(
      expect.arrayContaining(["id", "run_id", "mission_id", "schedule_id", "status", "usage_json"]),
    );
    expect(cols(db, "schedules")).toEqual(
      expect.arrayContaining(["next_run_at", "catch_up_policy", "repeat_times"]),
    );
    expect(cols(db, "missions")).toContain("run_id");
    expect(cols(db, "agent_profiles")).toEqual(
      expect.arrayContaining(["gateway_host", "gateway_port", "api_key_ref"]),
    );
    db.close();
  });

  it("009 apply migration upgrades a pre-runs/schedules DB and is idempotent", () => {
    const db = withMeta(new Database(":memory:"));
    db.exec("CREATE TABLE missions (id TEXT PRIMARY KEY);");
    db.exec("CREATE TABLE agent_profiles (slug TEXT PRIMARY KEY);");

    applyRunsSchedulesMigration(db, migrationsDir);
    applyRunsSchedulesMigration(db, migrationsDir); // second run must be a no-op

    expect(tableNames(db)).toEqual(expect.arrayContaining(["runs", "schedules"]));
    expect(cols(db, "missions")).toContain("run_id");
    expect(cols(db, "agent_profiles")).toEqual(
      expect.arrayContaining(["gateway_host", "gateway_port", "api_key_ref"]),
    );
    expect(getSchemaVersion(db)).toBe(8);
    db.close();
  });

  it("enforces the runs.status CHECK constraint", () => {
    const db = withMeta(new Database(":memory:"));
    db.exec(readFileSync(join(migrationsDir, "001_baseline.sql"), "utf-8"));
    db.prepare("INSERT INTO missions (id, name, prompt) VALUES ('m1','n','p')").run();

    expect(() =>
      db.prepare("INSERT INTO runs (id, mission_id, status) VALUES ('r1','m1','started')").run(),
    ).not.toThrow();
    expect(() =>
      db.prepare("INSERT INTO runs (id, mission_id, status) VALUES ('r2','m1','bogus')").run(),
    ).toThrow();
    db.close();
  });
});
