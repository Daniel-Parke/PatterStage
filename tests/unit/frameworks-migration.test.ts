/** @jest-environment node */
// Phase 2 — the v27 frameworks registry migration against REAL SQLite: the
// table, the seeded default active Hermes row, schema_version 27, idempotency.

import { join } from "path";
import type DatabaseNs from "better-sqlite3";
import { applyFrameworksMigration } from "@/lib/db/apply-frameworks-migration";
import { getSchemaVersion, setSchemaVersion } from "@/lib/db-schema";

type RealDb = DatabaseNs.Database;
const Database = jest.requireActual(
  join(process.cwd(), "node_modules", "better-sqlite3", "lib", "index.js"),
) as unknown as new (path: string) => RealDb;
const migrationsDir = join(process.cwd(), "src", "lib", "db", "migrations");

function makeDb(): RealDb {
  const db = new Database(":memory:");
  db.exec("CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);");
  setSchemaVersion(db, 26);
  return db;
}

describe("frameworks migration (v27, real SQLite)", () => {
  it("creates the table + seeds the default active Hermes framework, bumps to 27", () => {
    const db = makeDb();
    const result = applyFrameworksMigration(db, migrationsDir);
    const row = db
      .prepare("SELECT type, name, is_active, enabled, config_json FROM frameworks WHERE type='hermes'")
      .get() as { type: string; name: string; is_active: number; enabled: number; config_json: string };
    expect(row.type).toBe("hermes");
    expect(row.name).toBe("Hermes");
    expect(row.is_active).toBe(1);
    expect(row.enabled).toBe(1);
    expect(JSON.parse(row.config_json)).toEqual({ home: null });
    expect(result).toBe(27);
    expect(getSchemaVersion(db)).toBe(27);
    db.close();
  });

  it("is idempotent (one seed row) and version-guards", () => {
    const db = makeDb();
    applyFrameworksMigration(db, migrationsDir);
    applyFrameworksMigration(db, migrationsDir);
    expect((db.prepare("SELECT COUNT(*) c FROM frameworks").get() as { c: number }).c).toBe(1);
    db.close();

    const fresh = makeDb();
    setSchemaVersion(fresh, 27);
    applyFrameworksMigration(fresh, migrationsDir);
    const names = (
      fresh.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]
    ).map((r) => r.name);
    expect(names).not.toContain("frameworks");
    fresh.close();
  });
});
