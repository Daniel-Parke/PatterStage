/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * @jest-environment node
 *
 * Integration test for MissionSync — verifies that when the on-disk
 * `<id>.status.json` is read and the mission transitions, the matching
 * session row is also closed via `closeSessionForMission`.
 *
 * This is the regression test for the original bug: sessions table
 * never received the terminal update, so rows stayed "active" forever
 * even when their mission was "successful".
 *
 * Mocks:
 *   - `@/lib/paths` — point PATHS.missions at a tmp dir we control
 *   - `process.kill` — pretend the process is alive (or not, per test)
 *   - `@/lib/db` — replace the singleton with an in-memory DB
 *   - `@/lib/mission-repository` — stub listMissions / updateMission
 */
import Database from "better-sqlite3";
import { readFileSync, mkdtempSync, rmSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const repoRoot = join(__dirname, "..", "..");
const migrationsDir = join(repoRoot, "src", "lib", "db", "migrations");
const baselineSql = readFileSync(join(migrationsDir, "001_baseline.sql"), "utf-8");

function loadRealBetterSqlite3(): typeof import("better-sqlite3") {
  return require("better-sqlite3/lib/index.js") as typeof import("better-sqlite3");
}

let tmpRoot: string;
let testDb: Database.Database;
let missionsDir: string;
const mockListMissions = jest.fn();
const mockUpdateMission = jest.fn();

beforeAll(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), "ch-mission-sync-"));
  missionsDir = join(tmpRoot, "missions");
  // Note: PATHS.missions is mocked per-test below — this dir is for the
  // MissionSync sync() call's actual filesystem reads.
  const RealDatabase = loadRealBetterSqlite3();
  const db = new (RealDatabase as unknown as new (
    path: string,
  ) => import("better-sqlite3").Database)(":memory:");
  db.pragma("foreign_keys = ON");
  db.exec(baselineSql);
  testDb = db as unknown as Database.Database;
});

afterAll(() => {
  if (testDb) testDb.close();
  if (tmpRoot && existsSync(tmpRoot)) rmSync(tmpRoot, { recursive: true, force: true });
});

beforeEach(() => {
  // Reset DB between tests
  testDb.exec("DELETE FROM sessions; DELETE FROM missions;");
  mockListMissions.mockReset();
  mockUpdateMission.mockReset();
  // Clean tmp files between tests so we can write per-test status.json
  // without seeing leftovers. Simpler than per-test subdirs.
  if (existsSync(missionsDir)) {
    rmSync(missionsDir, { recursive: true, force: true });
  }
  require("fs").mkdirSync(missionsDir, { recursive: true });
  jest.resetModules();
  jest.doMock("@/lib/paths", () => {
    const actual = jest.requireActual("@/lib/paths") as Record<string, unknown>;
    return { ...actual, PATHS: { ...(actual.PATHS as object), missions: missionsDir } };
  });
  jest.doMock("@/lib/db", () => {
    const actual = jest.requireActual("@/lib/db") as Record<string, unknown>;
    return { ...actual, db: () => testDb };
  });
  jest.doMock("@/lib/mission-repository", () => {
    const actual = jest.requireActual("@/lib/mission-repository") as Record<string, unknown>;
    return {
      ...actual,
      listMissions: (...args: unknown[]) => mockListMissions(...args),
      updateMission: (...args: unknown[]) => mockUpdateMission(...args),
    };
  });
  // Don't actually try to kill a real PID in tests
  jest.spyOn(process, "kill").mockImplementation(((pid: number, signal: number | string) => {
    if (signal === 0) {
      // Pretend the PID is dead (mimics orphan-process detection)
      const err = new Error("ESRCH") as NodeJS.ErrnoException;
      err.code = "ESRCH";
      throw err;
    }
    return true;
  }) as never);
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.resetModules();
  jest.dontMock("@/lib/paths");
  jest.dontMock("@/lib/db");
  jest.dontMock("@/lib/mission-repository");
});

function seedMission(args: { id: string; status: string; name?: string }): void {
  testDb.prepare(/* sql */ `
    INSERT INTO missions (id, name, prompt, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(args.id, args.name ?? "Test", "<hermes_mission></hermes_mission>", args.status, new Date().toISOString(), new Date().toISOString());
}

function seedSession(args: { id: string; missionId: string; source?: string }): void {
  testDb.prepare(/* sql */ `
    INSERT INTO sessions (id, agent_type, source, mission_id, started_at, status)
    VALUES (?, 'hermes', ?, ?, ?, 'active')
  `).run(args.id, args.source ?? "mission", args.missionId, new Date().toISOString());
}

describe("MissionSync.sync() — session closure bridge", () => {
  it("closes the session when status.json reports 'successful'", async () => {
    const missionId = "m-success";
    const sessionId = "s-success";
    seedMission({ id: missionId, status: "dispatched" });
    seedSession({ id: sessionId, missionId });

    // Write the on-disk status.json
    writeFileSync(
      join(missionsDir, `${missionId}.status.json`),
      JSON.stringify({
        status: "successful",
        exit_code: 0,
        completed_at: "2026-06-01T17:58:10.312Z",
      }),
    );

    mockListMissions.mockReturnValue([{ id: missionId, status: "dispatched" }]);
    mockUpdateMission.mockReturnValue({ id: missionId, status: "successful" });

    const { MissionSync } = require("@/lib/sync/sources/MissionSync") as {
      MissionSync: new () => { sync(): Promise<{ success: boolean; syncedCount: number }> };
    };
    const sync = new MissionSync();
    const result = await sync.sync();

    expect(result.success).toBe(true);
    expect(result.syncedCount).toBe(1);
    expect(mockUpdateMission).toHaveBeenCalledWith(missionId, { status: "successful" });

    // The session row should be closed
    const row = testDb.prepare("SELECT status, exit_code, ended_at FROM sessions WHERE id = ?").get(sessionId) as
      { status: string; exit_code: number; ended_at: string };
    expect(row.status).toBe("completed");
    expect(row.exit_code).toBe(0);
    expect(row.ended_at).toBe("2026-06-01T17:58:10.312Z");
  });

  it("closes the session when status.json reports 'failed'", async () => {
    const missionId = "m-fail";
    const sessionId = "s-fail";
    seedMission({ id: missionId, status: "dispatched" });
    seedSession({ id: sessionId, missionId });

    writeFileSync(
      join(missionsDir, `${missionId}.status.json`),
      JSON.stringify({
        status: "failed",
        exit_code: 137,
        completed_at: "2026-06-01T17:58:10.312Z",
        error: "OOM killed",
      }),
    );

    mockListMissions.mockReturnValue([{ id: missionId, status: "dispatched" }]);
    mockUpdateMission.mockReturnValue({ id: missionId, status: "failed" });

    const { MissionSync } = require("@/lib/sync/sources/MissionSync") as {
      MissionSync: new () => { sync(): Promise<{ success: boolean; syncedCount: number }> };
    };
    const sync = new MissionSync();
    await sync.sync();

    const row = testDb.prepare("SELECT status, exit_code, error FROM sessions WHERE id = ?").get(sessionId) as
      { status: string; exit_code: number; error: string };
    expect(row.status).toBe("failed");
    expect(row.exit_code).toBe(137);
    expect(row.error).toBe("OOM killed");
  });

  it("closes the session when the mission process is dead (orphan path)", async () => {
    const missionId = "m-orphan";
    const sessionId = "s-orphan";
    seedMission({ id: missionId, status: "dispatched" });
    seedSession({ id: sessionId, missionId });

    // No status.json, but a pid.json with a now-dead PID
    writeFileSync(
      join(missionsDir, `${missionId}.pid.json`),
      JSON.stringify({ pid: 99999, startedAt: "2026-06-01T17:45:00.000Z" }),
    );

    mockListMissions.mockReturnValue([{ id: missionId, status: "dispatched" }]);
    mockUpdateMission.mockReturnValue({ id: missionId, status: "failed" });

    const { MissionSync } = require("@/lib/sync/sources/MissionSync") as {
      MissionSync: new () => { sync(): Promise<{ success: boolean; syncedCount: number }> };
    };
    const sync = new MissionSync();
    const result = await sync.sync();

    expect(result.success).toBe(true);
    expect(result.syncedCount).toBe(1);

    const row = testDb.prepare("SELECT status, error FROM sessions WHERE id = ?").get(sessionId) as
      { status: string; error: string };
    expect(row.status).toBe("failed");
    expect(row.error).toBe("Process terminated without completion");

    // A synthetic status.json should have been written so the next sync
    // doesn't repeat the orphan-detection work.
    expect(existsSync(join(missionsDir, `${missionId}.status.json`))).toBe(true);
  });

  it("does nothing when no active session exists for the mission (idempotent)", async () => {
    const missionId = "m-no-session";
    seedMission({ id: missionId, status: "dispatched" });
    // Note: NO session row is seeded — MissionSync should not crash

    writeFileSync(
      join(missionsDir, `${missionId}.status.json`),
      JSON.stringify({
        status: "successful",
        exit_code: 0,
        completed_at: "2026-06-01T17:58:10.312Z",
      }),
    );

    mockListMissions.mockReturnValue([{ id: missionId, status: "dispatched" }]);
    mockUpdateMission.mockReturnValue({ id: missionId, status: "successful" });

    const { MissionSync } = require("@/lib/sync/sources/MissionSync") as {
      MissionSync: new () => { sync(): Promise<{ success: boolean; syncedCount: number }> };
    };
    const sync = new MissionSync();
    const result = await sync.sync();

    expect(result.success).toBe(true);
    expect(result.syncedCount).toBe(1);
    // No session row to update — closeSessionForMission returns null silently
  });
});
