/** @jest-environment node */
// Verifies the v18 mission-phases migration against REAL SQLite. Covers: the
// three V2 tables + indexes created, the additive missions/runs columns added,
// schema_version bumped to 18, idempotency, and the version-guard early-return.

import { join } from "path";
import type DatabaseNs from "better-sqlite3";
import { applyMissionPhasesMigration } from "@/lib/db/apply-mission-phases-migration";
import { getSchemaVersion, setSchemaVersion } from "@/lib/db-schema";

type RealDb = DatabaseNs.Database;

const Database = jest.requireActual(
  join(process.cwd(), "node_modules", "better-sqlite3", "lib", "index.js"),
) as unknown as new (path: string) => RealDb;

const migrationsDir = join(process.cwd(), "src", "lib", "db", "migrations");

function tableNames(db: RealDb): string[] {
  return (
    db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]
  ).map((r) => r.name);
}
function columnNames(db: RealDb, table: string): string[] {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((r) => r.name);
}

/** A minimal pre-18 DB: meta + the missions/runs tables the v18 ALTERs touch. */
function makeDb(): RealDb {
  const db = new Database(":memory:");
  db.exec("CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);");
  db.exec("CREATE TABLE missions (id TEXT PRIMARY KEY, updated_at TEXT);");
  db.exec("CREATE TABLE runs (id TEXT PRIMARY KEY);");
  setSchemaVersion(db, 17);
  return db;
}

describe("mission-phases migration (v18, real SQLite)", () => {
  it("creates the V2 tables + additive columns and bumps schema_version to 18", () => {
    const db = makeDb();
    const result = applyMissionPhasesMigration(db, migrationsDir);

    expect(tableNames(db)).toEqual(
      expect.arrayContaining(["mission_phases", "mission_phase_actions", "mission_approvals"]),
    );
    expect(columnNames(db, "missions")).toEqual(
      expect.arrayContaining(["version", "current_phase_id"]),
    );
    expect(columnNames(db, "runs")).toEqual(expect.arrayContaining(["phase_action_id"]));
    expect(result).toBe(18);
    expect(getSchemaVersion(db)).toBe(18);
    db.close();
  });

  it("defaults missions.version to 'v1' for existing rows", () => {
    const db = makeDb();
    db.prepare("INSERT INTO missions (id) VALUES ('m1')").run();
    applyMissionPhasesMigration(db, migrationsDir);
    const row = db.prepare("SELECT version FROM missions WHERE id = 'm1'").get() as { version: string };
    expect(row.version).toBe("v1");
    db.close();
  });

  it("is idempotent — a second apply is a no-op and does not throw", () => {
    const db = makeDb();
    applyMissionPhasesMigration(db, migrationsDir);
    expect(() => applyMissionPhasesMigration(db, migrationsDir)).not.toThrow();
    expect(getSchemaVersion(db)).toBe(18);
    db.close();
  });

  it("version-guards: a DB already at v18 is left untouched (early return)", () => {
    const db = makeDb();
    setSchemaVersion(db, 18);
    const result = applyMissionPhasesMigration(db, migrationsDir);
    expect(result).toBe(18);
    expect(tableNames(db)).not.toContain("mission_phases");
    db.close();
  });
});
