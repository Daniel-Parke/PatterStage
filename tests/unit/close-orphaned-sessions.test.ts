/**
 * @jest-environment node
 *
 * Tests for the orphan-session sweep that fixes the "stuck active
 * sessions" bug — sessions whose parent mission ended but whose
 * session row was never written with `status: completed/failed`.
 *
 * Two layers are tested:
 *   1. `previewOrphanSweep` — dry-run count
 *   2. `closeOrphanedActiveSessions` — the actual write
 *
 * Both functions take a `Database` as their first argument, so we
 * can drive them with a real in-memory SQLite DB seeded with the
 * baseline schema. No mocking of `getDb()` required.
 *
 * Plus: `closeSessionForMission()` — the bridge that `MissionSync`
 * uses to close a session row in lockstep with a mission status
 * transition. This function uses the global `getDb()` singleton, so
 * the bridge tests mock `@/lib/db` to redirect calls to the
 * in-memory DB.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
import Database from "better-sqlite3";
import { readFileSync } from "fs";
import { join } from "path";

import {
  closeOrphanedActiveSessions,
  previewOrphanSweep,
} from "@/lib/sessions/session-orphan-sweep";
import { closeSessionForMission } from "@/lib/sessions/session-repository";

const repoRoot = join(__dirname, "..", "..");
const migrationsDir = join(repoRoot, "src", "lib", "db", "migrations");
const baselineSql = readFileSync(join(migrationsDir, "001_baseline.sql"), "utf-8");

function loadRealBetterSqlite3(): typeof import("better-sqlite3") {
  return require("better-sqlite3/lib/index.js") as typeof import("better-sqlite3");
}

interface TestDatabase {
  db: Database.Database;
  close: () => void;
}

/**
 * Build a fresh in-memory SQLite DB with the baseline schema applied.
 * Mirrors what `getDb()` produces on disk, but isolated per test.
 */
function makeTestDatabase(): TestDatabase {
  const RealDatabase = loadRealBetterSqlite3();
  const db = new (RealDatabase as unknown as new (
    path: string,
  ) => import("better-sqlite3").Database)(":memory:");
  db.pragma("foreign_keys = ON");
  db.exec(baselineSql);
  return {
    db: db as unknown as Database.Database,
    close: () => db.close(),
  };
}

function isoMinutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

function seedMission(
  db: Database.Database,
  args: { id: string; name?: string; status: string; deletedAt?: string | null },
): void {
  db.prepare(/* sql */ `
    INSERT INTO missions (id, name, prompt, status, created_at, updated_at, deleted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    args.id,
    args.name ?? "Test Mission",
    "<hermes_mission></hermes_mission>",
    args.status,
    isoMinutesAgo(30),
    isoMinutesAgo(30),
    args.deletedAt ?? null,
  );
}

function seedSession(
  db: Database.Database,
  args: {
    id: string;
    source: string;
    missionId?: string | null;
    status?: string;
    startedMinutesAgo?: number;
    size?: number;
  },
): void {
  db.prepare(/* sql */ `
    INSERT INTO sessions (id, agent_type, source, mission_id, size, started_at, status)
    VALUES (?, 'hermes', ?, ?, ?, ?, ?)
  `).run(
    args.id,
    args.source,
    args.missionId ?? null,
    args.size ?? 0,
    isoMinutesAgo(args.startedMinutesAgo ?? 10),
    args.status ?? "active",
  );
}

describe("closeOrphanedActiveSessions — parent-mission path", () => {
  let tdb: TestDatabase;
  beforeEach(() => { tdb = makeTestDatabase(); });
  afterEach(() => { tdb.close(); });

  it("closes an active session whose parent mission is 'successful'", () => {
    seedMission(tdb.db, { id: "m1", status: "successful" });
    seedSession(tdb.db, { id: "s1", source: "mission", missionId: "m1", startedMinutesAgo: 10 });

    const result = closeOrphanedActiveSessions(tdb.db, { log: false });

    expect(result.total).toBe(1);
    expect(result.bySource.mission).toBe(1);
    expect(result.byNewStatus.completed).toBe(1);

    const row = tdb.db.prepare("SELECT status, exit_code, ended_at FROM sessions WHERE id = 's1'").get() as
      { status: string; exit_code: number; ended_at: string };
    expect(row.status).toBe("completed");
    expect(row.exit_code).toBe(0);
    expect(row.ended_at).toBeTruthy();
  });

  it("closes an active session whose parent mission is 'failed'", () => {
    seedMission(tdb.db, { id: "m1", status: "failed" });
    seedSession(tdb.db, { id: "s1", source: "mission", missionId: "m1", startedMinutesAgo: 10 });

    const result = closeOrphanedActiveSessions(tdb.db, { log: false });

    expect(result.total).toBe(1);
    expect(result.byNewStatus.failed).toBe(1);

    const row = tdb.db.prepare("SELECT status, exit_code FROM sessions WHERE id = 's1'").get() as
      { status: string; exit_code: number };
    expect(row.status).toBe("failed");
    expect(row.exit_code).toBe(1);
  });

  it("closes cron, discord, and telegram source sessions uniformly", () => {
    seedMission(tdb.db, { id: "m1", status: "successful" });
    seedMission(tdb.db, { id: "m2", status: "failed" });
    seedMission(tdb.db, { id: "m3", status: "successful" });
    seedSession(tdb.db, { id: "cron-s", source: "cron", missionId: "m1", startedMinutesAgo: 10 });
    seedSession(tdb.db, { id: "disc-s", source: "discord", missionId: "m2", startedMinutesAgo: 10 });
    seedSession(tdb.db, { id: "tg-s",   source: "telegram", missionId: "m3", startedMinutesAgo: 10 });

    const result = closeOrphanedActiveSessions(tdb.db, { log: false });

    expect(result.total).toBe(3);
    expect(result.bySource).toEqual({ cron: 1, discord: 1, telegram: 1 });
    expect(result.byNewStatus).toEqual({ completed: 2, failed: 1 });
  });

  it("does NOT close a session whose parent mission is still 'dispatched'", () => {
    seedMission(tdb.db, { id: "m1", status: "dispatched" });
    seedSession(tdb.db, { id: "s1", source: "mission", missionId: "m1", startedMinutesAgo: 10 });

    const result = closeOrphanedActiveSessions(tdb.db, { log: false });

    expect(result.total).toBe(0);
    const row = tdb.db.prepare("SELECT status FROM sessions WHERE id = 's1'").get() as { status: string };
    expect(row.status).toBe("active");
  });

  it("closes sessions whose parent mission is soft-deleted (parent is gone, session is orphaned)", () => {
    // A soft-deleted mission means the parent is effectively gone.
    // The session is by definition orphaned and should be closed as
    // 'completed' (we can't derive failure from a deleted parent).
    seedMission(tdb.db, { id: "m1", status: "successful", deletedAt: isoMinutesAgo(5) });
    seedSession(tdb.db, { id: "s1", source: "mission", missionId: "m1", startedMinutesAgo: 10 });

    const result = closeOrphanedActiveSessions(tdb.db, { log: false });

    expect(result.total).toBe(1);
    expect(result.byNewStatus.completed).toBe(1);
    const row = tdb.db.prepare("SELECT status, exit_code FROM sessions WHERE id = 's1'").get() as
      { status: string; exit_code: number };
    expect(row.status).toBe("completed");
    expect(row.exit_code).toBe(0);
  });

  it("closes sessions whose parent mission has been hard-deleted (no row in missions)", () => {
    // Seed a session with a valid mission_id, then hard-delete the
    // mission via raw SQL (FK ON DELETE SET NULL would normally NULL
    // it out, so we have to drop the FK enforcement for this test).
    seedMission(tdb.db, { id: "m1", status: "successful" });
    seedSession(tdb.db, { id: "s1", source: "mission", missionId: "m1", startedMinutesAgo: 10 });
    tdb.db.pragma("foreign_keys = OFF");
    tdb.db.prepare("DELETE FROM missions WHERE id = ?").run("m1");
    tdb.db.pragma("foreign_keys = ON");

    const result = closeOrphanedActiveSessions(tdb.db, { log: false });

    expect(result.total).toBe(1);
    const row = tdb.db.prepare("SELECT status FROM sessions WHERE id = 's1'").get() as { status: string };
    expect(row.status).toBe("completed");
  });

  it("does NOT close a session started less than 5 minutes ago (boot safety window)", () => {
    seedMission(tdb.db, { id: "m1", status: "successful" });
    seedSession(tdb.db, { id: "s1", source: "mission", missionId: "m1", startedMinutesAgo: 2 });

    const result = closeOrphanedActiveSessions(tdb.db, { log: false });

    expect(result.total).toBe(0);
    const row = tdb.db.prepare("SELECT status FROM sessions WHERE id = 's1'").get() as { status: string };
    expect(row.status).toBe("active");
  });

  it("only closes the active row for a mission, leaves historical completed/failed rows alone", () => {
    seedMission(tdb.db, { id: "m1", status: "successful" });
    seedSession(tdb.db, { id: "s-old", source: "mission", missionId: "m1", startedMinutesAgo: 60, status: "completed" });
    seedSession(tdb.db, { id: "s-new", source: "mission", missionId: "m1", startedMinutesAgo: 10, status: "active" });

    const result = closeOrphanedActiveSessions(tdb.db, { log: false });

    expect(result.total).toBe(1);
    const oldRow = tdb.db.prepare("SELECT status FROM sessions WHERE id = 's-old'").get() as { status: string };
    const newRow = tdb.db.prepare("SELECT status FROM sessions WHERE id = 's-new'").get() as { status: string };
    expect(oldRow.status).toBe("completed");
    expect(newRow.status).toBe("completed");
  });
});

describe("closeOrphanedActiveSessions — age-fallback path", () => {
  let tdb: TestDatabase;
  beforeEach(() => { tdb = makeTestDatabase(); });
  afterEach(() => { tdb.close(); });

  it("closes parentless active sessions older than 5 minutes with size > 0", () => {
    seedSession(tdb.db, { id: "s1", source: "cli", missionId: null, startedMinutesAgo: 10, size: 100 });
    seedSession(tdb.db, { id: "s2", source: "api", missionId: null, startedMinutesAgo: 10, size: 50 });

    const result = closeOrphanedActiveSessions(tdb.db, { log: false });

    expect(result.total).toBe(2);
    expect(result.bySource).toEqual({ cli: 1, api: 1 });
    expect(result.byNewStatus.completed).toBe(2);
  });

  it("does NOT close empty (size=0) parentless sessions in the boot window", () => {
    seedSession(tdb.db, { id: "s1", source: "cli", missionId: null, startedMinutesAgo: 10, size: 0 });

    const result = closeOrphanedActiveSessions(tdb.db, { log: false });

    expect(result.total).toBe(0);
    const row = tdb.db.prepare("SELECT status FROM sessions WHERE id = 's1'").get() as { status: string };
    expect(row.status).toBe("active");
  });

  it("does NOT close parentless sessions started < 5 minutes ago", () => {
    seedSession(tdb.db, { id: "s1", source: "cli", missionId: null, startedMinutesAgo: 2, size: 100 });

    const result = closeOrphanedActiveSessions(tdb.db, { log: false });

    expect(result.total).toBe(0);
  });

  it("closes parentless empty sessions older than 30 minutes (clearly orphaned)", () => {
    // size=0 means the session never wrote any content, so the
    // 5-min/size>0 gate excludes it. But 30+ minutes is far past
    // any conceivable boot window — the session is orphaned.
    seedSession(tdb.db, { id: "s1", source: "cli", missionId: null, startedMinutesAgo: 45, size: 0 });

    const result = closeOrphanedActiveSessions(tdb.db, { log: false });

    expect(result.total).toBe(1);
    expect(result.bySource.cli).toBe(1);
    expect(result.byNewStatus.completed).toBe(1);
  });

  it("does NOT close parentless empty sessions started 5-30 min ago (in the boot window)", () => {
    // 15 min old but size=0: not enough to trigger the 30-min orphan
    // gate, and the size>0 gate excludes it. This protects sessions
    // that are mid-boot.
    seedSession(tdb.db, { id: "s1", source: "cli", missionId: null, startedMinutesAgo: 15, size: 0 });

    const result = closeOrphanedActiveSessions(tdb.db, { log: false });

    expect(result.total).toBe(0);
  });
});

// ── Resurrection guard (active↔closed churn fix) ──────────────────
//
// The Hermes-session upsert in syncHermesSessionsToDb must NOT reset a
// locally-closed session back to 'active' when Hermes still reports
// end_reason: null (excluded.status = 'active'). Without the guard the
// orphan sweep re-closes the same rows every 15s tick forever. This block
// pins the exact ON CONFLICT status CASE used by the upsert.
describe("Hermes-session upsert — resurrection guard", () => {
  let tdb: TestDatabase;
  beforeEach(() => { tdb = makeTestDatabase(); });
  afterEach(() => { tdb.close(); });

  // Mirror of the upsert's status clause in src/lib/session-sync.ts. Keep in
  // lockstep with that statement.
  function upsertHermesStatus(id: string, incomingStatus: string): void {
    tdb.db.prepare(/* sql */ `
      INSERT INTO sessions (id, agent_type, source, size, started_at, status)
      VALUES (?, 'hermes', 'cli', 0, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        status = CASE
                   WHEN excluded.status = 'active'
                        AND sessions.status IN ('completed', 'failed', 'cancelled')
                     THEN sessions.status
                   ELSE excluded.status
                 END
    `).run(id, isoMinutesAgo(10), incomingStatus);
  }
  const statusOf = (id: string) =>
    (tdb.db.prepare("SELECT status FROM sessions WHERE id = ?").get(id) as { status: string }).status;

  it("does NOT resurrect a locally-closed session to 'active'", () => {
    seedSession(tdb.db, { id: "s1", source: "cli", status: "completed", startedMinutesAgo: 10 });
    upsertHermesStatus("s1", "active"); // Hermes still reports end_reason: null
    expect(statusOf("s1")).toBe("completed");

    seedSession(tdb.db, { id: "s2", source: "cli", status: "failed", startedMinutesAgo: 10 });
    upsertHermesStatus("s2", "active");
    expect(statusOf("s2")).toBe("failed");
  });

  it("still lets a real terminal end_reason close an active session", () => {
    seedSession(tdb.db, { id: "s1", source: "cli", status: "active", startedMinutesAgo: 10 });
    upsertHermesStatus("s1", "completed"); // end_reason: stop → excluded.status='completed'
    expect(statusOf("s1")).toBe("completed");
  });

  it("leaves a genuinely-active session active", () => {
    seedSession(tdb.db, { id: "s1", source: "cli", status: "active", startedMinutesAgo: 1 });
    upsertHermesStatus("s1", "active");
    expect(statusOf("s1")).toBe("active");
  });
});

describe("previewOrphanSweep", () => {
  let tdb: TestDatabase;
  beforeEach(() => { tdb = makeTestDatabase(); });
  afterEach(() => { tdb.close(); });

  it("matches closeOrphanedActiveSessions counts exactly (dry-run parity)", () => {
    seedMission(tdb.db, { id: "m1", status: "successful" });
    seedMission(tdb.db, { id: "m2", status: "failed" });
    seedSession(tdb.db, { id: "s1", source: "mission", missionId: "m1", startedMinutesAgo: 10 });
    seedSession(tdb.db, { id: "s2", source: "mission", missionId: "m2", startedMinutesAgo: 10 });
    seedSession(tdb.db, { id: "s3", source: "cli", missionId: null, startedMinutesAgo: 30, size: 100 });
    seedSession(tdb.db, { id: "s-active", source: "mission", missionId: "m1", startedMinutesAgo: 1 });
    // dispatched mission: should NOT close
    seedMission(tdb.db, { id: "m-running", status: "dispatched" });
    seedSession(tdb.db, { id: "s-running", source: "mission", missionId: "m-running", startedMinutesAgo: 10 });

    const preview = previewOrphanSweep(tdb.db);
    const actual = closeOrphanedActiveSessions(tdb.db, { log: false });

    expect(preview).toEqual(actual);
    // Sanity: numbers are sensible
    expect(actual.total).toBe(3); // 2 mission (m1,m2) + 1 cli fallback
    expect(actual.byNewStatus).toEqual({ completed: 2, failed: 1 });
  });
});

// ── closeSessionForMission tests ──────────────────────────────────
//
// This function uses the global `getDb()` singleton, so the bridge
// tests mock `@/lib/db` to redirect the singleton to the in-memory
// DB. Each test owns its own mock + DB so the bridge tests can run
// in parallel safely.
describe("closeSessionForMission — the MissionSync bridge", () => {
  let tdb: TestDatabase;

  beforeEach(() => {
    tdb = makeTestDatabase();
    // Replace the global getDb() singleton for the duration of this test
    jest.resetModules();
    jest.doMock("@/lib/db", () => {
      const actual = jest.requireActual("@/lib/db");
      return { ...actual, getDb: () => tdb.db };
    });
  });

  afterEach(() => {
    tdb.close();
    jest.resetModules();
    jest.dontMock("@/lib/db");
  });

  it("closes the active session for a mission with status='completed'", () => {
    // Re-import after mock is set
    const { closeSessionForMission: close } = require("@/lib/sessions/session-repository") as {
      closeSessionForMission: typeof closeSessionForMission;
    };
    seedMission(tdb.db, { id: "m1", status: "dispatched" });
    seedSession(tdb.db, { id: "s1", source: "mission", missionId: "m1", startedMinutesAgo: 10 });

    const closedId = close("m1", {
      status: "completed",
      endedAt: "2026-06-01T17:58:10.312Z",
      exitCode: 0,
      error: null,
    });

    expect(closedId).toBe("s1");
    const row = tdb.db.prepare("SELECT status, ended_at, exit_code FROM sessions WHERE id = 's1'").get() as
      { status: string; ended_at: string; exit_code: number };
    expect(row.status).toBe("completed");
    expect(row.ended_at).toBe("2026-06-01T17:58:10.312Z");
    expect(row.exit_code).toBe(0);
  });

  it("closes with status='failed' and preserves error message", () => {
    const { closeSessionForMission: close } = require("@/lib/sessions/session-repository") as {
      closeSessionForMission: typeof closeSessionForMission;
    };
    seedMission(tdb.db, { id: "m1", status: "dispatched" });
    seedSession(tdb.db, { id: "s1", source: "mission", missionId: "m1", startedMinutesAgo: 10 });

    close("m1", {
      status: "failed",
      endedAt: "2026-06-01T17:58:10.312Z",
      exitCode: 137,
      error: "Process terminated without completion",
    });

    const row = tdb.db.prepare("SELECT status, exit_code, error FROM sessions WHERE id = 's1'").get() as
      { status: string; exit_code: number; error: string };
    expect(row.status).toBe("failed");
    expect(row.exit_code).toBe(137);
    expect(row.error).toBe("Process terminated without completion");
  });

  it("returns null and is a no-op when no active session exists", () => {
    const { closeSessionForMission: close } = require("@/lib/sessions/session-repository") as {
      closeSessionForMission: typeof closeSessionForMission;
    };
    seedMission(tdb.db, { id: "m1", status: "successful" });
    seedSession(tdb.db, { id: "s1", source: "mission", missionId: "m1", startedMinutesAgo: 10, status: "completed" });

    const result = close("m1", {
      status: "completed",
      endedAt: "2026-06-01T17:58:10.312Z",
      exitCode: 0,
      error: null,
    });

    expect(result).toBeNull();
  });

  it("picks the most recently started active session for recurring missions", () => {
    const { closeSessionForMission: close } = require("@/lib/sessions/session-repository") as {
      closeSessionForMission: typeof closeSessionForMission;
    };
    seedMission(tdb.db, { id: "m1", status: "dispatched" });
    seedSession(tdb.db, { id: "s-old", source: "mission", missionId: "m1", startedMinutesAgo: 60, status: "completed" });
    seedSession(tdb.db, { id: "s-new", source: "mission", missionId: "m1", startedMinutesAgo: 5, status: "active" });

    const closedId = close("m1", {
      status: "completed",
      endedAt: "2026-06-01T17:58:10.312Z",
      exitCode: 0,
      error: null,
    });

    expect(closedId).toBe("s-new");
    // The completed historical row is untouched
    const oldRow = tdb.db.prepare("SELECT status FROM sessions WHERE id = 's-old'").get() as { status: string };
    expect(oldRow.status).toBe("completed");
  });
});
