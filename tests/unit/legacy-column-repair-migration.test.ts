// Regression coverage for the orphaned-column migration bug: the incremental
// applier chain jumped schema_version 5 -> 7, so 005_cron_workdir and
// 006_sessions_message_count were never applied to upgraded DBs (a real install
// was found at v8 with runs/schedules present but cron_jobs.workdir absent,
// surfacing as "no such column: workdir"). Verified against REAL SQLite (the
// global better-sqlite3 mock is bypassed via the on-disk path).

import { readFileSync } from "fs";
import { join } from "path";
import type DatabaseNs from "better-sqlite3";
import {
  applyLegacyColumnRepair,
  LEGACY_COLUMN_REPAIR_SCHEMA_VERSION,
} from "@/lib/db/apply-legacy-column-repair";
import { applyProfilesToolsParityUpgrade } from "@/lib/db/apply-profiles-tools-upgrade";
import { applyMissionRepeatMigration } from "@/lib/db/apply-mission-repeat-migration";
import { applyMissionQueueMigration } from "@/lib/db/apply-mission-queue-migration";
import { applyCronScheduleCanonicalisation } from "@/lib/db/apply-cron-schedule-canonicalisation";
import { applyRunsSchedulesMigration } from "@/lib/db/apply-runs-schedules-migration";
import { getSchemaVersion, setSchemaVersion } from "@/lib/db-schema";

type RealDb = DatabaseNs.Database;

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

/** Open a fresh in-memory DB on the squashed baseline schema. */
function baselineDb(): RealDb {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  db.exec("CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);");
  db.exec(readFileSync(join(migrationsDir, "001_baseline.sql"), "utf-8"));
  return db;
}

/** Drop a column / tables to simulate a DB that missed a migration. */
function degrade(db: RealDb, fn: (d: RealDb) => void): void {
  db.pragma("foreign_keys = OFF");
  fn(db);
  db.pragma("foreign_keys = ON");
}

describe("applyLegacyColumnRepair — orphaned 005/006 column catch-up", () => {
  it("adds cron_jobs.workdir on a v8 DB that missed it, preserving rows", () => {
    const db = baselineDb();
    db.prepare(
      "INSERT INTO cron_jobs (id, name, schedule) VALUES ('c1','nightly','0 0 * * *')",
    ).run();
    degrade(db, (d) => d.exec("ALTER TABLE cron_jobs DROP COLUMN workdir"));
    setSchemaVersion(db, 8);
    expect(cols(db, "cron_jobs")).not.toContain("workdir");

    const result = applyLegacyColumnRepair(db);

    expect(result).toBe(LEGACY_COLUMN_REPAIR_SCHEMA_VERSION);
    expect(cols(db, "cron_jobs")).toContain("workdir");
    expect(getSchemaVersion(db)).toBe(9);
    // Existing row preserved; new column defaulted to ''.
    const row = db.prepare("SELECT id, workdir FROM cron_jobs WHERE id='c1'").get() as {
      id: string;
      workdir: string;
    };
    expect(row.id).toBe("c1");
    expect(row.workdir).toBe("");
    db.close();
  });

  it("adds sessions.message_count (the squashed baseline omits it entirely)", () => {
    const db = baselineDb();
    setSchemaVersion(db, 8);
    // 006_sessions_message_count was never folded into the baseline, so even a
    // fresh baseline DB lacks this column until the repair runs.
    expect(cols(db, "sessions")).not.toContain("message_count");

    applyLegacyColumnRepair(db);

    expect(cols(db, "sessions")).toContain("message_count");
    db.close();
  });

  it("is idempotent and a no-op on a fresh baseline DB that already has the columns", () => {
    const db = baselineDb();
    setSchemaVersion(db, 8);
    expect(cols(db, "cron_jobs")).toContain("workdir"); // baseline already has it

    applyLegacyColumnRepair(db);
    applyLegacyColumnRepair(db); // second run must be a no-op

    expect(getSchemaVersion(db)).toBe(9);
    expect(cols(db, "cron_jobs")).toContain("workdir");
    expect(cols(db, "sessions")).toContain("message_count");
    db.close();
  });

  it("returns early without re-running once at version 9", () => {
    const db = baselineDb();
    setSchemaVersion(db, 9);
    expect(applyLegacyColumnRepair(db)).toBe(9);
    db.close();
  });

  it("end-to-end: a degraded DB upgraded through the full applier chain ends fully migrated", () => {
    // Simulate a legacy install: baseline schema, then strip the new schema
    // (workdir column + runs/schedules tables) and mark it old.
    const db = baselineDb();
    db.prepare(
      "INSERT INTO cron_jobs (id, name, schedule) VALUES ('c1','job','0 0 * * *')",
    ).run();
    degrade(db, (d) => {
      d.exec("ALTER TABLE cron_jobs DROP COLUMN workdir");
      d.exec("DROP TABLE IF EXISTS runs");
      d.exec("DROP TABLE IF EXISTS schedules");
    });
    setSchemaVersion(db, 2);

    // Run the appliers in the same order as runMigrations().
    applyProfilesToolsParityUpgrade(db, migrationsDir);
    applyMissionRepeatMigration(db, migrationsDir);
    applyMissionQueueMigration(db, migrationsDir);
    applyCronScheduleCanonicalisation(db);
    applyRunsSchedulesMigration(db, migrationsDir);
    applyLegacyColumnRepair(db);

    // Full new schema is present.
    expect(cols(db, "cron_jobs")).toContain("workdir");
    expect(cols(db, "sessions")).toContain("message_count");
    expect(tableNames(db)).toEqual(expect.arrayContaining(["runs", "schedules"]));
    expect(cols(db, "missions")).toContain("run_id");
    expect(getSchemaVersion(db)).toBe(9);
    // Pre-existing data survived the upgrade.
    expect(
      (db.prepare("SELECT COUNT(*) c FROM cron_jobs").get() as { c: number }).c,
    ).toBe(1);
    db.close();
  });
});
