/** @jest-environment node */
// ORACLE for T-0021 (WO-0014): the setting's home.
//
// Clause 6 re-decided where the figure lives. It is a user setting, so it lives
// in the database beside the other settings, not in a governing file. This file
// holds the v33 migration against REAL SQLite (the global better-sqlite3 mock is
// bypassed via requireActual).
//
// The two assertions that matter are not about columns. They are:
//
//   1. the seeded row is UNSET on every install, fresh and upgraded alike, and
//      the seed is INSERT OR IGNORE so a re-run cannot overwrite a choice the
//      operator already made (clause 2);
//   2. the database itself refuses to hold a hard stop with no figure beside it
//      (clause 4). A stop with no ceiling is not a strict setting, it is an
//      outage, and this is the layer where "cannot" is cheaper than "should not".

import { join } from "path";
import type DatabaseNs from "better-sqlite3";
import {
  applySpendPolicyMigration,
  SPEND_POLICY_SCHEMA_VERSION,
} from "@/lib/db/apply-spend-policy-migration";
import { getSchemaVersion, setSchemaVersion } from "@/lib/db-schema";

type RealDb = DatabaseNs.Database;

const Database = jest.requireActual(
  join(process.cwd(), "node_modules", "better-sqlite3", "lib", "index.js"),
) as unknown as new (path: string) => RealDb;

const migrationsDir = join(process.cwd(), "src", "lib", "db", "migrations");

function cols(db: RealDb, table: string): string[] {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((r) => r.name);
}

function migrated(): RealDb {
  const db = new Database(":memory:");
  db.exec("CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);");
  setSchemaVersion(db, 32);
  applySpendPolicyMigration(db, migrationsDir);
  return db;
}

describe("spend policy migration (v33, real SQLite)", () => {
  it("creates the settings table with every column the feature needs", () => {
    const db = migrated();
    expect(cols(db, "spend_policy")).toEqual(
      expect.arrayContaining(["id", "limit_usd", "period", "hard_stop", "updated_at"]),
    );
    db.close();
  });

  it("bumps the schema version to its gate", () => {
    const db = migrated();
    expect(getSchemaVersion(db)).toBe(SPEND_POLICY_SCHEMA_VERSION);
    expect(SPEND_POLICY_SCHEMA_VERSION).toBe(33);
    db.close();
  });

  it("returns early without touching anything when the database is already past the gate", () => {
    const db = new Database(":memory:");
    db.exec("CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);");
    setSchemaVersion(db, 33);
    expect(applySpendPolicyMigration(db, migrationsDir)).toBe(33);
    const tables = (
      db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]
    ).map((r) => r.name);
    expect(tables).not.toContain("spend_policy");
    db.close();
  });

  it("is idempotent", () => {
    const db = migrated();
    setSchemaVersion(db, 32);
    expect(() => applySpendPolicyMigration(db, migrationsDir)).not.toThrow();
    expect(getSchemaVersion(db)).toBe(SPEND_POLICY_SCHEMA_VERSION);
    db.close();
  });

  // Clause 2, as data. This is the assertion the whole row turns on.
  it("seeds exactly one row, with NO figure and NO stop", () => {
    const db = migrated();
    const row = db.prepare("SELECT * FROM spend_policy").get() as {
      id: number;
      limit_usd: number | null;
      period: string;
      hard_stop: number;
    };
    expect((db.prepare("SELECT COUNT(*) c FROM spend_policy").get() as { c: number }).c).toBe(1);
    expect(row.id).toBe(1);
    expect(row.limit_usd).toBeNull();
    expect(row.hard_stop).toBe(0);
    expect(row.period).toBe("month");
    db.close();
  });

  it("never overwrites a figure the operator already set", () => {
    const db = migrated();
    db.prepare("UPDATE spend_policy SET limit_usd = 40, hard_stop = 1, period = 'week'").run();
    setSchemaVersion(db, 32);
    applySpendPolicyMigration(db, migrationsDir);

    const row = db.prepare("SELECT * FROM spend_policy").get() as {
      limit_usd: number | null;
      period: string;
      hard_stop: number;
    };
    expect(row.limit_usd).toBe(40);
    expect(row.hard_stop).toBe(1);
    expect(row.period).toBe("week");
    db.close();
  });
});

describe("the database refuses a policy that would be dishonest", () => {
  it("refuses a hard stop with no figure beside it", () => {
    const db = migrated();
    expect(() => db.prepare("UPDATE spend_policy SET hard_stop = 1").run()).toThrow(/constraint/i);
    db.close();
  });

  it("refuses to clear the figure out from under an armed stop", () => {
    const db = migrated();
    db.prepare("UPDATE spend_policy SET limit_usd = 40, hard_stop = 1").run();
    expect(() => db.prepare("UPDATE spend_policy SET limit_usd = NULL").run()).toThrow(/constraint/i);
    db.close();
  });

  it("refuses a second row, so there is exactly one budget", () => {
    const db = migrated();
    expect(() => db.prepare("INSERT INTO spend_policy (id) VALUES (2)").run()).toThrow(/constraint/i);
    db.close();
  });

  it("refuses a zero or negative figure", () => {
    const db = migrated();
    expect(() => db.prepare("UPDATE spend_policy SET limit_usd = 0").run()).toThrow(/constraint/i);
    expect(() => db.prepare("UPDATE spend_policy SET limit_usd = -5").run()).toThrow(/constraint/i);
    db.close();
  });

  it("refuses a period it does not know how to measure", () => {
    const db = migrated();
    expect(() => db.prepare("UPDATE spend_policy SET period = 'fortnight'").run()).toThrow(/constraint/i);
    db.close();
  });
});
