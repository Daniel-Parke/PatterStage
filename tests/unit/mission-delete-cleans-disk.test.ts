/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * @jest-environment node
 *
 * Bug regression test: deleteMission (mission-repository.ts) only
 * soft-deletes the DB row and never touches the on-disk artifacts.
 * Consequence: a deleted mission leaves a `<id>.json`,
 * `<id>.status.json`, `<id>.pid.json`, `<id>.session`, and
 * `<id>.output.log` orphaned on disk, contributing to the
 * accumulation of 38 disk-only orphan files we found on
 * 2026-06-11.
 *
 * Fix: deleteMission also unlinks the on-disk artifacts
 * (best-effort, ignore missing).
 */
import Database from "better-sqlite3";
import { mkdtempSync, rmSync, existsSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const repoRoot = join(__dirname, "..", "..");
const migrationsDir = join(repoRoot, "src", "lib", "db", "migrations");
const baselineSql = require("fs").readFileSync(join(migrationsDir, "001_baseline.sql"), "utf-8");

function loadRealBetterSqlite3(): typeof import("better-sqlite3") {
  return require("better-sqlite3/lib/index.js") as typeof import("better-sqlite3");
}

let tmpRoot: string;
let testDb: Database.Database;
let missionsDir: string;

beforeAll(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), "ch-delete-mission-"));
  missionsDir = join(tmpRoot, "missions");
  const RealDatabase = loadRealBetterSqlite3();
  const db = new (RealDatabase as unknown as new (
    path: string,
  ) => import("better-sqlite3").Database)(":memory:");
  db.pragma("foreign_keys = ON");
  db.exec(baselineSql);
  testDb = db as unknown as Database.Database;
  require("fs").mkdirSync(missionsDir, { recursive: true });
});

afterAll(() => {
  if (testDb) testDb.close();
  if (tmpRoot && existsSync(tmpRoot)) rmSync(tmpRoot, { recursive: true, force: true });
});

beforeEach(() => {
  testDb.exec("DELETE FROM sessions; DELETE FROM missions;");
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
    return {
      ...actual,
      db: () => testDb,
      inTransaction: (fn: () => unknown) => fn(),
    };
  });
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.resetModules();
  jest.dontMock("@/lib/paths");
  jest.dontMock("@/lib/db");
});

describe("deleteMission — on-disk cleanup", () => {
  it("removes all 5 on-disk artifact files for the deleted mission", () => {
    const { createMission, deleteMission } = require("@/lib/mission-repository") as {
      createMission: (data: { name: string; prompt: string }) => { id: string };
      deleteMission: (id: string) => boolean;
    };

    const mission = createMission({ name: "Test", prompt: "<hermes_mission></hermes_mission>" });
    const id = mission.id;

    // Write the 5 on-disk artifact files
    const artifacts = [
      `${id}.json`,
      `${id}.status.json`,
      `${id}.pid.json`,
      `${id}.session`,
      `${id}.output.log`,
    ];
    for (const filename of artifacts) {
      writeFileSync(join(missionsDir, filename), "{}");
    }

    // Sanity: all 5 files exist before delete
    for (const filename of artifacts) {
      expect(existsSync(join(missionsDir, filename))).toBe(true);
    }

    const deleted = deleteMission(id);
    expect(deleted).toBe(true);

    // All 5 on-disk artifacts should be gone after delete
    for (const filename of artifacts) {
      expect(existsSync(join(missionsDir, filename))).toBe(false);
    }
  });

  it("does not throw when on-disk artifacts are missing (idempotent disk delete)", () => {
    const { createMission, deleteMission } = require("@/lib/mission-repository") as {
      createMission: (data: { name: string; prompt: string }) => { id: string };
      deleteMission: (id: string) => boolean;
    };

    const mission = createMission({ name: "NoArtifacts", prompt: "<hermes_mission></hermes_mission>" });

    // No on-disk files at all — delete must not throw even though
    // existsSync returns false for every artifact.
    expect(() => deleteMission(mission.id)).not.toThrow();
    // The point of this test: the call didn't throw even though
    // every artifact was missing. We don't re-assert return
    // value — a second call returns false because the row is
    // already soft-deleted (existing behavior, unchanged by
    // this fix).
  });

  it("returns false and does not crash for a non-existent mission id", () => {
    const { deleteMission } = require("@/lib/mission-repository") as {
      deleteMission: (id: string) => boolean;
    };
    expect(deleteMission("does-not-exist")).toBe(false);
  });
});
