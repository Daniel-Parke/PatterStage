/** @jest-environment node */
// Verifies the v32 retention migration against REAL SQLite (the global
// better-sqlite3 mock is bypassed via requireActual).
//
// The two assertions that matter most are not about shape:
//
//   "seeds both policies DISABLED" is the whole safety posture of ADR-0009. If
//   this ever goes green with enabled = 1, an upgrade deletes a stranger's
//   history, which is the one outcome this task was written to prevent.
//
//   "refuses a window below the floor" proves the floor is a CHECK constraint
//   rather than a comment. The floor is what protects the consumers named in the
//   policy row, so it has to be held by the database and not by whoever is
//   editing the settings that day.
//
// Full-chain wiring (runMigrations actually calls the applier) is guarded in
// run-migrations-upgrade.integration.test.ts.

import { join } from "path";
import type DatabaseNs from "better-sqlite3";
import {
  applyRetentionMigration,
  RETENTION_SCHEMA_VERSION,
} from "@/lib/db/apply-retention-migration";
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
  setSchemaVersion(db, 31);
  applyRetentionMigration(db, migrationsDir);
  return db;
}

describe("retention migration (v32, real SQLite)", () => {
  it("creates both bookkeeping tables with the columns the prune record needs", () => {
    const db = migrated();

    expect(namesOfType(db, "table")).toEqual(
      expect.arrayContaining(["retention_policy", "retention_prune_runs"]),
    );
    expect(cols(db, "retention_policy")).toEqual(
      expect.arrayContaining([
        "table_name",
        "owner",
        "consumer",
        "enabled",
        "retain_days",
        "updated_at",
      ]),
    );
    expect(cols(db, "retention_prune_runs")).toEqual(
      expect.arrayContaining([
        "id",
        "ran_at",
        "table_name",
        "outcome",
        "retain_days",
        "cutoff",
        "rows_matched",
        "rows_deleted",
        "progression_watermark",
        "detail",
      ]),
    );
    db.close();
  });

  it("seeds both policies DISABLED, so an upgrade deletes nothing", () => {
    const db = migrated();

    const rows = db
      .prepare("SELECT table_name, enabled, retain_days, owner, consumer FROM retention_policy ORDER BY table_name")
      .all() as { table_name: string; enabled: number; retain_days: number; owner: string; consumer: string }[];

    expect(rows.map((r) => r.table_name)).toEqual(["analytics_events", "chat_messages"]);
    expect(rows.every((r) => r.enabled === 0)).toBe(true);
    // Owner and consumer are named, which is half of what WG-ARCH-008 asks a
    // readings table to declare.
    expect(rows.every((r) => r.owner.length > 0 && r.consumer.length > 0)).toBe(true);
    expect(rows.find((r) => r.table_name === "analytics_events")!.retain_days).toBe(400);
    expect(rows.find((r) => r.table_name === "chat_messages")!.retain_days).toBe(365);
    db.close();
  });

  it("does not touch a policy an operator has already set", () => {
    const db = migrated();
    db.prepare(
      "UPDATE retention_policy SET enabled = 1, retain_days = 500 WHERE table_name = 'analytics_events'",
    ).run();

    // Re-apply the SQL for real, not just the version guard.
    setSchemaVersion(db, 31);
    applyRetentionMigration(db, migrationsDir);

    const row = db
      .prepare("SELECT enabled, retain_days FROM retention_policy WHERE table_name = 'analytics_events'")
      .get() as { enabled: number; retain_days: number };
    expect(row).toEqual({ enabled: 1, retain_days: 500 });
    db.close();
  });

  it("refuses a window below the floor, and allows one above it", () => {
    const db = migrated();

    expect(() =>
      db.prepare("UPDATE retention_policy SET retain_days = 364 WHERE table_name = 'analytics_events'").run(),
    ).toThrow(/CHECK constraint/i);
    expect(() =>
      db.prepare("UPDATE retention_policy SET retain_days = 29 WHERE table_name = 'chat_messages'").run(),
    ).toThrow(/CHECK constraint/i);

    expect(() =>
      db.prepare("UPDATE retention_policy SET retain_days = 3650 WHERE table_name = 'chat_messages'").run(),
    ).not.toThrow();
    db.close();
  });

  it("refuses a policy row for a table nobody declared", () => {
    const db = migrated();

    expect(() =>
      db
        .prepare(
          "INSERT INTO retention_policy (table_name, owner, consumer, retain_days) VALUES ('missions','x','y',400)",
        )
        .run(),
    ).toThrow(/CHECK constraint/i);
    db.close();
  });

  it("makes the deletion record append-only, enforced by the database", () => {
    const db = migrated();
    expect(namesOfType(db, "trigger")).toEqual(
      expect.arrayContaining([
        "retention_prune_runs_no_update",
        "retention_prune_runs_no_delete",
      ]),
    );

    db.prepare(
      `INSERT INTO retention_prune_runs (table_name, outcome, retain_days, cutoff, rows_matched, rows_deleted)
       VALUES ('analytics_events','pruned',400,'2025-07-18 00:00:00',10,10)`,
    ).run();

    expect(() =>
      db.prepare("UPDATE retention_prune_runs SET rows_deleted = 0 WHERE id = 1").run(),
    ).toThrow(/append-only/);
    expect(() => db.prepare("DELETE FROM retention_prune_runs").run()).toThrow(/append-only/);
    expect(
      (db.prepare("SELECT COUNT(*) c FROM retention_prune_runs").get() as { c: number }).c,
    ).toBe(1);
    db.close();
  });

  it("bumps schema_version to 32 and is idempotent", () => {
    const db = withMeta(new Database(":memory:"));
    setSchemaVersion(db, 31);

    applyRetentionMigration(db, migrationsDir);
    expect(getSchemaVersion(db)).toBe(RETENTION_SCHEMA_VERSION);
    expect(RETENTION_SCHEMA_VERSION).toBe(32);

    setSchemaVersion(db, 31);
    expect(() => applyRetentionMigration(db, migrationsDir)).not.toThrow();
    expect(getSchemaVersion(db)).toBe(32);
    db.close();
  });

  it("version-guards: a DB already at v32 is left untouched (early return)", () => {
    const db = withMeta(new Database(":memory:"));
    setSchemaVersion(db, RETENTION_SCHEMA_VERSION);

    expect(applyRetentionMigration(db, migrationsDir)).toBe(RETENTION_SCHEMA_VERSION);
    expect(namesOfType(db, "table")).not.toContain("retention_policy");
    db.close();
  });
});
