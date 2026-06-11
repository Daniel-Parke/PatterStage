/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * @jest-environment node
 *
 * Bug regression test: MissionSync only iterated DB missions, not
 * on-disk `.json` files. The result: 38 on-disk orphan mission files
 * (the production data we found in 2026-06-11 investigation) were
 * invisible to the reconciler and accumulated forever.
 *
 * Root cause:
 *   1. `deleteMission` (mission-repository.ts) soft-deletes the DB
 *      row but never cleans the on-disk artifacts.
 *   2. Even when the DB row exists with status='dispatched', a manual
 *      `rm` of the missions dir (e.g. cleanup script, container
 *      recreate) can leave the DB row stranded.
 *
 * Fix: MissionSync now sweeps `PATHS.missions/*.json` once per cycle
 * and reconciles any file that has no matching DB row (active or
 * soft-deleted) — it writes a synthetic failed status.json so the
 * next cycle is a no-op, and the orphan file is left in place (we do
 * NOT delete it; downstream tooling may still want to read it).
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
  tmpRoot = mkdtempSync(join(tmpdir(), "ch-mission-disk-orphan-"));
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
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.resetModules();
  jest.dontMock("@/lib/paths");
  jest.dontMock("@/lib/db");
  jest.dontMock("@/lib/mission-repository");
});

describe("MissionSync.sync() — disk-only orphan reconciliation", () => {
  it("writes a failed status.json for an on-disk mission file with no matching DB row", async () => {
    // No DB row, no DB session — only an on-disk mission file
    // (the 2026-06-11 production symptom).
    const orphanId = "m-disk-orphan-1";
    writeFileSync(
      join(missionsDir, `${orphanId}.json`),
      JSON.stringify({
        id: orphanId,
        name: "Disk Orphan",
        prompt: "<hermes_mission></hermes_mission>",
        status: "dispatched",
        createdAt: "2026-06-11T10:00:00.000Z",
        updatedAt: "2026-06-11T10:00:00.000Z",
      }),
    );

    // No DB missions to iterate
    mockListMissions.mockReturnValue([]);

    const { MissionSync } = require("@/lib/sync/sources/MissionSync") as {
      MissionSync: new () => { sync(): Promise<{ success: boolean; syncedCount: number }> };
    };
    const sync = new MissionSync();
    await sync.sync();

    // A synthetic failed status.json should be on disk now
    const statusPath = join(missionsDir, `${orphanId}.status.json`);
    expect(existsSync(statusPath)).toBe(true);
    const parsed = JSON.parse(readFileSync(statusPath, "utf-8"));
    expect(parsed.status).toBe("failed");
    // The error message should make it clear this is the disk-orphan path
    expect(parsed.error).toMatch(/orphan|disk|no matching/i);
  });

  it("does NOT add a disk-only orphan status for a mission with a matching DB row + existing status.json", async () => {
    const missionId = "m-matches-db";
    writeFileSync(
      join(missionsDir, `${missionId}.json`),
      JSON.stringify({
        id: missionId,
        name: "Real Mission",
        prompt: "<hermes_mission></hermes_mission>",
        status: "dispatched",
        createdAt: "2026-06-11T10:00:00.000Z",
        updatedAt: "2026-06-11T10:00:00.000Z",
      }),
    );
    // Add a matching DB row
    testDb.prepare(/* sql */ `
      INSERT INTO missions (id, name, prompt, status, created_at, updated_at)
      VALUES (?, 'Real Mission', '<hermes_mission></hermes_mission>', 'dispatched', ?, ?)
    `).run(missionId, new Date().toISOString(), new Date().toISOString());
    // Provide a status.json so the existing happy-path branch handles it
    // (this is the common case: bash script finished and wrote a status
    // while the DB row still says "dispatched" pending next sync tick)
    writeFileSync(
      join(missionsDir, `${missionId}.status.json`),
      JSON.stringify({
        status: "successful",
        exit_code: 0,
        completed_at: "2026-06-11T10:05:00.000Z",
      }),
    );

    mockListMissions.mockReturnValue([{ id: missionId, status: "dispatched" }]);
    mockUpdateMission.mockReturnValue({ id: missionId, status: "successful" });

    const { MissionSync } = require("@/lib/sync/sources/MissionSync") as {
      MissionSync: new () => { sync(): Promise<{ success: boolean; syncedCount: number }> };
    };
    const sync = new MissionSync();
    await sync.sync();

    // The existing status.json is NOT overwritten with a synthetic
    // disk-orphan status — the happy-path branch handles it.
    const statusPath = join(missionsDir, `${missionId}.status.json`);
    const parsed = JSON.parse(readFileSync(statusPath, "utf-8"));
    expect(parsed.status).toBe("successful");
  });

  it("skips files that are not mission files (e.g. status.json, pid.json, output.log)", async () => {
    // The sweep must be type-specific — only *.json mission files,
    // not the companion status/pid/output files which share the
    // mission id as basename.
    const id = "m-no-confusion";
    writeFileSync(
      join(missionsDir, `${id}.json`),
      JSON.stringify({
        id,
        name: "Orphan",
        prompt: "<hermes_mission></hermes_mission>",
        status: "dispatched",
        createdAt: "2026-06-11T10:00:00.000Z",
        updatedAt: "2026-06-11T10:00:00.000Z",
      }),
    );
    // Companion files should be left alone — the sweep must not
    // also "match" these as mission ids.
    writeFileSync(
      join(missionsDir, `${id}.status.json`),
      JSON.stringify({
        status: "successful",
        exit_code: 0,
        completed_at: "2026-06-11T10:05:00.000Z",
      }),
    );

    mockListMissions.mockReturnValue([]);

    const { MissionSync } = require("@/lib/sync/sources/MissionSync") as {
      MissionSync: new () => { sync(): Promise<{ success: boolean; syncedCount: number }> };
    };
    const sync = new MissionSync();
    await sync.sync();

    // The original .status.json is preserved (we don't overwrite
    // a successful status with a synthetic failed one)
    const statusPath = join(missionsDir, `${id}.status.json`);
    const parsed = JSON.parse(readFileSync(statusPath, "utf-8"));
    expect(parsed.status).toBe("successful");
  });
});
