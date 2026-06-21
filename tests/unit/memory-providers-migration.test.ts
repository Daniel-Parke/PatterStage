/** @jest-environment node */
// Verifies the v22 memory_providers migration against REAL SQLite: the table,
// the seeded default Hindsight row, schema_version 22, idempotency + guard.

import { join } from "path";
import type DatabaseNs from "better-sqlite3";
import { applyMemoryProvidersMigration } from "@/lib/db/apply-memory-providers-migration";
import { getSchemaVersion, setSchemaVersion } from "@/lib/db-schema";

type RealDb = DatabaseNs.Database;
const Database = jest.requireActual(
  join(process.cwd(), "node_modules", "better-sqlite3", "lib", "index.js"),
) as unknown as new (path: string) => RealDb;
const migrationsDir = join(process.cwd(), "src", "lib", "db", "migrations");

function makeDb(): RealDb {
  const db = new Database(":memory:");
  db.exec("CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);");
  setSchemaVersion(db, 21);
  return db;
}

describe("memory_providers migration (v22, real SQLite)", () => {
  it("creates the table + seeds the default active Hindsight provider, bumps to 22", () => {
    const db = makeDb();
    const result = applyMemoryProvidersMigration(db, migrationsDir);
    const row = db
      .prepare("SELECT type, is_active, enabled, config_json FROM memory_providers WHERE type='hindsight'")
      .get() as { type: string; is_active: number; enabled: number; config_json: string };
    expect(row.type).toBe("hindsight");
    expect(row.is_active).toBe(1);
    expect(row.enabled).toBe(1);
    expect(JSON.parse(row.config_json)).toEqual({ host: "127.0.0.1", port: 9177, bank: "hermes" });
    expect(result).toBe(22);
    expect(getSchemaVersion(db)).toBe(22);
    db.close();
  });

  it("is idempotent (one seed row) and version-guards", () => {
    const db = makeDb();
    applyMemoryProvidersMigration(db, migrationsDir);
    applyMemoryProvidersMigration(db, migrationsDir);
    const count = (db.prepare("SELECT COUNT(*) c FROM memory_providers").get() as { c: number }).c;
    expect(count).toBe(1);

    const fresh = makeDb();
    setSchemaVersion(fresh, 22);
    applyMemoryProvidersMigration(fresh, migrationsDir);
    const names = (
      fresh.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]
    ).map((r) => r.name);
    expect(names).not.toContain("memory_providers");
    fresh.close();
  });
});
