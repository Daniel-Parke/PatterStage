/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * @jest-environment node
 *
 * Bug regression test: MissionSync's orphan-detection had a dead branch
 * when the PID file is missing. The pre-fix code (MissionSync.ts:120-138):
 *
 *   if (pid !== null && !isPidAlive(pid)) {
 *     // mark failed
 *   }
 *   continue;  // silently skips when pid === null
 *
 * Symptom: a `dispatched` mission whose bash script was SIGKILLed AND
 * whose `.pid.json` was also gone (e.g. host reboot, manual `rm`,
 * async-redirect SIGKILL mid-write) would stay `dispatched` forever
 * on the dashboard even though no process was running.
 *
 * Fix: when both status.json AND pid.json are missing, the mission
 * is unrecoverable. Mark it `failed` with an explicit error and
 * close the session.
 */
import Database from "better-sqlite3";
import { readFileSync, mkdtempSync, rmSync, existsSync } from "fs";
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
  tmpRoot = mkdtempSync(join(tmpdir(), "ch-mission-orphan-pid-missing-"));
  missionsDir = join(tmpRoot, "missions");
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
  testDb.exec("DELETE FROM sessions; DELETE FROM missions;");
  mockListMissions.mockReset();
  mockUpdateMission.mockReset();
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
  // Pretend any PID is dead — we want the existing orphan branch to
  // attempt the failure transition. The new fallback path is supposed
  // to fire even when pid === null.
  jest.spyOn(process, "kill").mockImplementation(((pid: number, signal: number | string) => {
    if (signal === 0) {
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

function seedMission(args: { id: string; status: string }): void {
  testDb.prepare(/* sql */ `
    INSERT INTO missions (id, name, prompt, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(args.id, "Test Mission", "<hermes_mission></hermes_mission>", args.status, new Date().toISOString(), new Date().toISOString());
}

function seedSession(args: { id: string; missionId: string }): void {
  testDb.prepare(/* sql */ `
    INSERT INTO sessions (id, agent_type, source, mission_id, started_at, status)
    VALUES (?, 'hermes', 'mission', ?, ?, 'active')
  `).run(args.id, args.missionId, new Date().toISOString());
}

describe("MissionSync.sync() — orphan recovery when PID file is also missing", () => {
  it("transitions a dispatched mission to failed when both status.json and pid.json are absent", async () => {
    const missionId = "m-no-status-no-pid";
    seedMission({ id: missionId, status: "dispatched" });
    seedSession({ id: "s-no-status-no-pid", missionId });

    // No on-disk files at all — neither status.json nor pid.json.
    // This is the exact failure mode: bash script was SIGKILLed mid-flight
    // before writing the status file, AND the PID file was cleaned up
    // (host reboot, manual rm, parent shell death).

    mockListMissions.mockReturnValue([{ id: missionId, status: "dispatched" }]);
    mockUpdateMission.mockReturnValue({ id: missionId, status: "failed" });

    const { MissionSync } = require("@/lib/sync/sources/MissionSync") as {
      MissionSync: new () => { sync(): Promise<{ success: boolean; syncedCount: number }> };
    };
    const sync = new MissionSync();
    const result = await sync.sync();

    expect(result.success).toBe(true);
    // The mission MUST have been transitioned to failed
    expect(mockUpdateMission).toHaveBeenCalledWith(
      missionId,
      expect.objectContaining({ status: "failed" }),
    );

    // The session row MUST be closed
    const row = testDb
      .prepare("SELECT status, error FROM sessions WHERE id = ?")
      .get("s-no-status-no-pid") as { status: string; error: string };
    expect(row.status).toBe("failed");
    expect(row.error).toMatch(/lost|missing|terminated/i);
  });

  it("writes a synthetic failed status.json so the next sync cycle is a no-op", async () => {
    const missionId = "m-write-synthetic";
    seedMission({ id: missionId, status: "dispatched" });

    mockListMissions.mockReturnValue([{ id: missionId, status: "dispatched" }]);
    mockUpdateMission.mockReturnValue({ id: missionId, status: "failed" });

    const { MissionSync } = require("@/lib/sync/sources/MissionSync") as {
      MissionSync: new () => { sync(): Promise<{ success: boolean; syncedCount: number }> };
    };
    const sync = new MissionSync();
    await sync.sync();

    // After the fallback, a status.json should be on disk so future
    // sync ticks read it as a normal "failed" status.json and don't
    // re-attempt the orphan detection.
    const statusPath = join(missionsDir, `${missionId}.status.json`);
    expect(existsSync(statusPath)).toBe(true);
    const parsed = JSON.parse(readFileSync(statusPath, "utf-8"));
    expect(parsed.status).toBe("failed");
  });
});
