/** @jest-environment node */
// Verifies the v31 agent-progression migration against REAL SQLite (the global
// better-sqlite3 mock is bypassed via requireActual). Covers: the table, its
// index and BOTH append-only triggers created, schema_version bumped to 31,
// idempotency, and the version-guard early return.
//
// The triggers' behaviour is proved separately in
// agent-progression-immutability.test.ts. This file only asserts they exist,
// because "the object is in sqlite_master" and "the object refuses a write" are
// different claims and the second one is the one the acceptance rests on.
//
// Full-chain wiring (runMigrations actually calls the applier) is guarded in
// run-migrations-upgrade.integration.test.ts.

import { join } from "path";
import type DatabaseNs from "better-sqlite3";
import {
  applyAgentProgressionMigration,
  AGENT_PROGRESSION_SCHEMA_VERSION,
} from "@/lib/db/apply-agent-progression-migration";
import { getSchemaVersion, setSchemaVersion } from "@/lib/db-schema";

type RealDb = DatabaseNs.Database;

const Database = jest.requireActual(
  join(process.cwd(), "node_modules", "better-sqlite3", "lib", "index.js"),
) as unknown as new (path: string) => RealDb;

const migrationsDir = join(process.cwd(), "src", "lib", "db", "migrations");

function namesOfType(db: RealDb, type: string): string[] {
  return (
    db.prepare("SELECT name FROM sqlite_master WHERE type = ?").all(type) as { name: string }[]
  ).map((r) => r.name);
}
function cols(db: RealDb, table: string): string[] {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((r) => r.name);
}
function withMeta(db: RealDb): RealDb {
  db.exec("CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);");
  return db;
}
function migrated(): RealDb {
  const db = withMeta(new Database(":memory:"));
  setSchemaVersion(db, 30);
  applyAgentProgressionMigration(db, migrationsDir);
  return db;
}

describe("agent progression migration (v31, real SQLite)", () => {
  it("creates the table with every column a row needs to be auditable", () => {
    const db = migrated();

    expect(namesOfType(db, "table")).toContain("agent_progression_snapshots");
    expect(cols(db, "agent_progression_snapshots")).toEqual(
      expect.arrayContaining([
        "id",
        "profile_slug",
        "captured_at",
        "level",
        "level_title",
        "xp",
        "achievements_scope",
        "achievements_json",
        "inputs_json",
        "inputs_digest",
        "schema_version",
        "computation_version",
      ]),
    );
    db.close();
  });

  it("creates the latest-per-profile index and both append-only triggers", () => {
    const db = migrated();

    expect(namesOfType(db, "index")).toContain("idx_agent_progression_profile_latest");
    expect(namesOfType(db, "trigger")).toEqual(
      expect.arrayContaining([
        "agent_progression_snapshots_no_update",
        "agent_progression_snapshots_no_delete",
      ]),
    );
    db.close();
  });

  it("bumps schema_version to 31", () => {
    const db = migrated();

    expect(getSchemaVersion(db)).toBe(AGENT_PROGRESSION_SCHEMA_VERSION);
    expect(AGENT_PROGRESSION_SCHEMA_VERSION).toBe(31);
    db.close();
  });

  it("is idempotent — a second apply is a no-op and does not throw", () => {
    const db = withMeta(new Database(":memory:"));
    setSchemaVersion(db, 30);

    applyAgentProgressionMigration(db, migrationsDir);
    // The guard alone would make the second call trivial, so wind the version
    // back and re-run the SQL for real: CREATE TABLE / INDEX / TRIGGER must all
    // be survivable a second time, which is what execIdempotent promises.
    setSchemaVersion(db, 30);
    expect(() => applyAgentProgressionMigration(db, migrationsDir)).not.toThrow();
    expect(getSchemaVersion(db)).toBe(31);
    db.close();
  });

  it("version-guards: a DB already at v31 is left untouched (early return)", () => {
    const db = withMeta(new Database(":memory:"));
    setSchemaVersion(db, AGENT_PROGRESSION_SCHEMA_VERSION);

    const result = applyAgentProgressionMigration(db, migrationsDir);

    expect(result).toBe(AGENT_PROGRESSION_SCHEMA_VERSION);
    expect(namesOfType(db, "table")).not.toContain("agent_progression_snapshots");
    db.close();
  });
});
