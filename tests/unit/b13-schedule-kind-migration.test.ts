/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports -- the applier this contract creates does not exist yet, so it is required where it is used: a missing file must red the tests that need it rather than the whole file at import time */

// ═══════════════════════════════════════════════════════════════
// B13 oracle, group migration-041 (T-0107, decision 10).
//
// Written before the product code moved. Contract sections 2.1-2.3.
//
// WHY THERE IS A MIGRATION AT ALL. Decision 10: the real-Hermes round runs
// natively on Windows, where there is no crontab, so the Scripts page's
// Schedule button has nowhere to write. PatterStage already owns a
// restart-safe timer for missions; 041 lets a `schedules` row name a SCRIPT
// instead of a mission, so that timer can carry it.
//
// `schedules.kind` DEFAULTs to 'mission', which is what every existing row is,
// so there is no backfill and the applier's version gate is a performance
// guard rather than a correctness one. That matters: execMigrationFile execs
// the whole .sql in ONE call and the already-applied guard swallows only the
// FIRST duplicate-column error, so a backfill placed in the .sql would be
// skipped on a re-run ([[db-migration-applier-footgun]]).
//
// Real SQLite throughout — the global better-sqlite3 mock is bypassed via
// requireActual, the same way spend-policy-migration.test.ts does it, because
// the assertions that matter here are the DEFAULT and the CHECK, and a mock
// cannot enforce either.
// ═══════════════════════════════════════════════════════════════

import { existsSync, readdirSync } from "fs";
import { join } from "path";
import type DatabaseNs from "better-sqlite3";

import { MIGRATION_HEAD_SCHEMA_VERSION, getSchemaVersion, setSchemaVersion } from "@/lib/db-schema";

type RealDb = DatabaseNs.Database;

const Database = jest.requireActual(
  join(process.cwd(), "node_modules", "better-sqlite3", "lib", "index.js"),
) as unknown as new (path: string) => RealDb;

const migrationsDir = join(process.cwd(), "src", "lib", "db", "migrations");
const sqlPath = join(migrationsDir, "041_schedule_kind.sql");

// ── the applier the contract creates, loaded lazily ────────────

interface ApplierModule {
  SCHEDULE_KIND_SCHEMA_VERSION: number;
  applyScheduleKindMigration: (db: RealDb, dir: string) => number;
}

function applier(): ApplierModule {
  let mod: unknown;
  try {
    mod = require("@/lib/db/apply-schedule-kind-migration");
  } catch {
    throw new Error("src/lib/db/apply-schedule-kind-migration.ts does not exist yet (contract 2.2)");
  }
  return mod as ApplierModule;
}

/** The `schedules` table as 001_baseline declares it, and nothing else. */
function baselineSchedules(): RealDb {
  const db = new Database(":memory:");
  db.exec("CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);");
  db.exec(`
    CREATE TABLE schedules (
      id               TEXT PRIMARY KEY,
      mission_id       TEXT,
      name             TEXT NOT NULL DEFAULT '',
      schedule         TEXT NOT NULL,
      schedule_display TEXT NOT NULL DEFAULT '',
      enabled          INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
      catch_up_policy  TEXT NOT NULL DEFAULT 'fire_once'
                         CHECK (catch_up_policy IN ('fire_once', 'skip')),
      repeat_times     INTEGER,
      repeat_done      INTEGER NOT NULL DEFAULT 0,
      profile_name     TEXT,
      next_run_at      TEXT,
      last_run_at      TEXT,
      last_run_id      TEXT,
      last_status      TEXT,
      created_at       TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  // A mission row that predates 041, so the DEFAULT is measured on real data.
  db.prepare(
    "INSERT INTO schedules (id, mission_id, name, schedule) VALUES ('s-old', 'm1', 'Nightly', '0 2 * * *')",
  ).run();
  setSchemaVersion(db, 40);
  return db;
}

function migrated(): RealDb {
  const db = baselineSchedules();
  applier().applyScheduleKindMigration(db, migrationsDir);
  return db;
}

function cols(db: RealDb, table: string): string[] {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((r) => r.name);
}

// ── FUSE ────────────────────────────────────────────────────────

describe("FUSE: real SQLite, in memory, no file on disk is touched", () => {
  it("opens :memory: and the baseline fixture really has no kind column", () => {
    const db = baselineSchedules();
    expect(cols(db, "schedules")).not.toContain("kind");
    expect(cols(db, "schedules")).toContain("mission_id");
    db.close();
  });
});

// ═══════════════════════════════════════════════════════════════
// 2.1 the file
// ═══════════════════════════════════════════════════════════════

describe("041_schedule_kind.sql", () => {
  it("exists, numbered 041", () => {
    expect(existsSync(sqlPath)).toBe(true);
  });

  it("is the highest-numbered migration on disk", () => {
    const numbers = readdirSync(migrationsDir)
      .filter((f) => /^\d{3}_.*\.sql$/.test(f))
      .map((f) => parseInt(f.slice(0, 3), 10));
    expect(numbers.length).toBeGreaterThan(20);
    expect(Math.max(...numbers)).toBe(41);
  });
});

// ═══════════════════════════════════════════════════════════════
// 2.2 the applier
// ═══════════════════════════════════════════════════════════════

describe("the schedules-kind migration (v41, real SQLite)", () => {
  it("adds kind and script_name to schedules", () => {
    const db = migrated();
    expect(cols(db, "schedules")).toEqual(expect.arrayContaining(["kind", "script_name"]));
    db.close();
  });

  it("calls every row that already existed a mission schedule", () => {
    const db = migrated();
    expect(
      db.prepare("SELECT kind, script_name FROM schedules WHERE id = 's-old'").get(),
    ).toEqual({ kind: "mission", script_name: null });
    db.close();
  });

  it("defaults a new row to 'mission' so no caller has to remember", () => {
    const db = migrated();
    db.prepare("INSERT INTO schedules (id, schedule) VALUES ('s-new', '0 5 * * *')").run();
    expect(
      (db.prepare("SELECT kind FROM schedules WHERE id = 's-new'").get() as { kind: string }).kind,
    ).toBe("mission");
    db.close();
  });

  it("admits a script row", () => {
    const db = migrated();
    db.prepare(
      "INSERT INTO schedules (id, schedule, kind, script_name) VALUES ('s-x', '0 3 * * *', 'script', 'ps-db-backup.mjs')",
    ).run();
    expect(db.prepare("SELECT kind, script_name FROM schedules WHERE id = 's-x'").get()).toEqual({
      kind: "script",
      script_name: "ps-db-backup.mjs",
    });
    db.close();
  });

  it("refuses a third kind at the storage layer, where 'cannot' is cheaper than 'should not'", () => {
    const db = migrated();
    expect(() =>
      db
        .prepare("INSERT INTO schedules (id, schedule, kind) VALUES ('s-bad', '0 3 * * *', 'agent')")
        .run(),
    ).toThrow(/CHECK constraint failed/i);
    db.close();
  });

  it("bumps the schema version to its gate", () => {
    const db = migrated();
    expect(getSchemaVersion(db)).toBe(applier().SCHEDULE_KIND_SCHEMA_VERSION);
    expect(applier().SCHEDULE_KIND_SCHEMA_VERSION).toBe(41);
    db.close();
  });

  it("is a no-op on a database that already has it (the version gate)", () => {
    const db = migrated();
    expect(() => applier().applyScheduleKindMigration(db, migrationsDir)).not.toThrow();
    expect(getSchemaVersion(db)).toBe(41);
    expect(cols(db, "schedules").filter((c) => c === "kind")).toHaveLength(1);
    db.close();
  });

  it("re-running the .sql itself is survivable, because there is no backfill to skip", () => {
    const db = migrated();
    setSchemaVersion(db, 40); // pretend the gate was lost
    expect(() => applier().applyScheduleKindMigration(db, migrationsDir)).not.toThrow();
    expect(
      db.prepare("SELECT kind FROM schedules WHERE id = 's-old'").get(),
    ).toEqual({ kind: "mission" });
    db.close();
  });
});

// ═══════════════════════════════════════════════════════════════
// 2.3 the head constant moves with it
// ═══════════════════════════════════════════════════════════════

describe("the applier's own gate", () => {
  it("refuses to run twice: it gates on >= 41", () => {
    const db = migrated();
    // `>` rather than `>=` would re-exec the file at exactly the head. Nothing
    // breaks today, because this .sql carries no backfill and
    // execMigrationFile swallows the duplicate-column error -- but the gate is
    // the guarantee the NEXT migration leans on when it does carry one, and a
    // gate that is off by one is not a gate.
    expect(applier().applyScheduleKindMigration(db, migrationsDir)).toBe(41);
    expect(getSchemaVersion(db)).toBe(41);
    // The pre-041 row is still the row it was: a second exec that got through
    // would have run whatever the file does to existing data.
    expect(
      db.prepare("SELECT kind, script_name FROM schedules WHERE id = 's-old'").get(),
    ).toEqual({ kind: "mission", script_name: null });
    db.close();
  });

  it("does not climb a database that is already past it", () => {
    const db = migrated();
    setSchemaVersion(db, 99);
    expect(applier().applyScheduleKindMigration(db, migrationsDir)).toBe(99);
    db.close();
  });
});

describe("the head constant", () => {
  it("equals this applier's gate — it is now the last rung", () => {
    expect(MIGRATION_HEAD_SCHEMA_VERSION).toBe(41);
  });
});
