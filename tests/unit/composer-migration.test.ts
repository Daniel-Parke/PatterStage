/** @jest-environment node */
// Verifies the v21 Composer migration against REAL SQLite: the six graph tables
// + runs.composer_node_run_id, schema_version 21, idempotency, version-guard.

import { join } from "path";
import type DatabaseNs from "better-sqlite3";
import { applyComposerMigration } from "@/lib/db/apply-composer-migration";
import { getSchemaVersion, setSchemaVersion } from "@/lib/db-schema";

type RealDb = DatabaseNs.Database;
const Database = jest.requireActual(
  join(process.cwd(), "node_modules", "better-sqlite3", "lib", "index.js"),
) as unknown as new (path: string) => RealDb;
const migrationsDir = join(process.cwd(), "src", "lib", "db", "migrations");

function tableNames(db: RealDb): string[] {
  return (db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]).map((r) => r.name);
}
function columnNames(db: RealDb, table: string): string[] {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((r) => r.name);
}
function makeDb(): RealDb {
  const db = new Database(":memory:");
  db.exec("CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);");
  db.exec("CREATE TABLE runs (id TEXT PRIMARY KEY);"); // for node_runs FK + the ALTER
  setSchemaVersion(db, 20);
  return db;
}

describe("composer migration (v21, real SQLite)", () => {
  it("creates the graph tables + runs.composer_node_run_id and bumps to 21", () => {
    const db = makeDb();
    const result = applyComposerMigration(db, migrationsDir);
    expect(tableNames(db)).toEqual(
      expect.arrayContaining([
        "composer_workflows",
        "composer_nodes",
        "composer_edges",
        "composer_runs",
        "composer_node_runs",
        "composer_approvals",
      ]),
    );
    expect(columnNames(db, "runs")).toContain("composer_node_run_id");
    expect(result).toBe(21);
    expect(getSchemaVersion(db)).toBe(21);
    db.close();
  });

  it("is idempotent and version-guards", () => {
    const db = makeDb();
    applyComposerMigration(db, migrationsDir);
    expect(() => applyComposerMigration(db, migrationsDir)).not.toThrow();
    expect(getSchemaVersion(db)).toBe(21);

    const fresh = makeDb();
    setSchemaVersion(fresh, 21);
    applyComposerMigration(fresh, migrationsDir);
    expect(tableNames(fresh)).not.toContain("composer_workflows");
    fresh.close();
    db.close();
  });
});
