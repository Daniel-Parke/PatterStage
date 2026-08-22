/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * @jest-environment node
 *
 * Tests for the PatterStage-owned scheduler state repository
 * (src/lib/schedules-repository.ts), driven against a real in-memory
 * SQLite DB seeded with the baseline schema. `@/lib/db` is mocked so the
 * repo's `getDb()` calls hit the test DB; `inTransaction` is stubbed to run
 * the callback directly (the real one closes over the real singleton).
 */
import type Database from "better-sqlite3";
import { readFileSync } from "fs";
import { join } from "path";

import type * as SchedulesRepo from "@/lib/schedules-repository";

const baselineSql = readFileSync(
  join(__dirname, "..", "..", "src", "lib", "db", "migrations", "001_baseline.sql"),
  "utf-8",
);

function loadRealBetterSqlite3(): typeof import("better-sqlite3") {
  return require("better-sqlite3/lib/index.js") as typeof import("better-sqlite3");
}

interface TestDatabase {
  db: Database.Database;
  close: () => void;
}

function makeTestDatabase(): TestDatabase {
  const RealDatabase = loadRealBetterSqlite3();
  const db = new (RealDatabase as unknown as new (path: string) => Database.Database)(":memory:");
  db.pragma("foreign_keys = ON");
  db.exec(baselineSql);
  return { db, close: () => db.close() };
}

function seedMission(db: Database.Database, id: string): void {
  db.prepare(
    `INSERT INTO missions (id, name, prompt, status, created_at, updated_at)
     VALUES (?, 'M', '<hermes_mission></hermes_mission>', 'queued', datetime('now'), datetime('now'))`,
  ).run(id);
}

describe("schedules-repository", () => {
  let tdb: TestDatabase;
  let repo: typeof SchedulesRepo;

  beforeEach(() => {
    tdb = makeTestDatabase();
    jest.resetModules();
    jest.doMock("@/lib/db", () => {
      const actual = jest.requireActual("@/lib/db");
      return {
        ...actual,
        getDb: () => tdb.db,
        inTransaction: (fn: () => unknown) => fn(),
      };
    });
    repo = require("@/lib/schedules-repository") as typeof SchedulesRepo;
  });

  afterEach(() => {
    tdb.close();
    jest.resetModules();
    jest.dontMock("@/lib/db");
  });

  it("createSchedule applies defaults + enabled coercion + round-trips", () => {
    const s = repo.createSchedule({ schedule: "every 30m" });
    expect(s).toMatchObject({
      schedule: "every 30m",
      name: "",
      scheduleDisplay: "",
      enabled: true,
      catchUpPolicy: "fire_once",
      repeatTimes: null,
      repeatDone: 0,
      missionId: null,
    });
    expect(repo.getSchedule(s.id)).toEqual(s);

    const disabled = repo.createSchedule({ schedule: "every 5m", enabled: false });
    expect(disabled.enabled).toBe(false);
  });

  it("getSchedule returns null for a missing id", () => {
    expect(repo.getSchedule("nope")).toBeNull();
  });

  it("listSchedules orders by created_at DESC (newest first)", () => {
    tdb.db.prepare(
      "INSERT INTO schedules (id, schedule, created_at, updated_at) VALUES (?, 'every 5m', ?, ?)",
    ).run("s_old", "2026-01-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z");
    tdb.db.prepare(
      "INSERT INTO schedules (id, schedule, created_at, updated_at) VALUES (?, 'every 5m', ?, ?)",
    ).run("s_new", "2026-02-01T00:00:00.000Z", "2026-02-01T00:00:00.000Z");
    expect(repo.listSchedules().map((s) => s.id)).toEqual(["s_new", "s_old"]);
  });

  it("getScheduleForMission returns the latest schedule for a mission", () => {
    seedMission(tdb.db, "m1");
    for (const [id, created] of [
      ["sch_a", "2026-01-01T00:00:00.000Z"],
      ["sch_b", "2026-03-01T00:00:00.000Z"],
    ] as const) {
      tdb.db.prepare(
        "INSERT INTO schedules (id, mission_id, schedule, created_at, updated_at) VALUES (?, 'm1', 'every 5m', ?, ?)",
      ).run(id, created, created);
    }
    expect(repo.getScheduleForMission("m1")?.id).toBe("sch_b");
    expect(repo.getScheduleForMission("absent")).toBeNull();
  });

  it("getDueSchedules returns only enabled rows with next_run_at <= asOf", () => {
    const rows: Array<[string, number, string | null]> = [
      ["due_enabled", 1, "2026-06-15T09:00:00.000Z"], // due
      ["future_enabled", 1, "2026-06-15T11:00:00.000Z"], // not yet
      ["due_disabled", 0, "2026-06-15T09:00:00.000Z"], // disabled
      ["null_next", 1, null], // never fires
    ];
    for (const [id, enabled, next] of rows) {
      tdb.db.prepare(
        "INSERT INTO schedules (id, schedule, enabled, next_run_at, created_at, updated_at) VALUES (?, 'every 5m', ?, ?, datetime('now'), datetime('now'))",
      ).run(id, enabled, next);
    }
    const due = repo.getDueSchedules("2026-06-15T10:00:00.000Z").map((s) => s.id);
    expect(due).toEqual(["due_enabled"]);
  });

  it("updateSchedule applies a partial patch", () => {
    const s = repo.createSchedule({ schedule: "every 30m", name: "orig" });
    const updated = repo.updateSchedule(s.id, { name: "renamed", enabled: false });
    expect(updated).toMatchObject({ name: "renamed", enabled: false, schedule: "every 30m" });
  });

  it("advanceSchedule stamps last_* + increments repeat_done + can disable", () => {
    const s = repo.createSchedule({ schedule: "every 30m", nextRunAt: "2026-06-15T09:00:00.000Z" });
    const advanced = repo.advanceSchedule(s.id, {
      nextRunAt: "2026-06-15T09:30:00.000Z",
      lastRunAt: "2026-06-15T09:00:01.000Z",
      lastRunId: "run_1",
      lastStatus: "dispatched",
      incrementDone: true,
      enabled: false,
    });
    expect(advanced).toMatchObject({
      nextRunAt: "2026-06-15T09:30:00.000Z",
      lastRunAt: "2026-06-15T09:00:01.000Z",
      lastRunId: "run_1",
      lastStatus: "dispatched",
      repeatDone: 1,
      enabled: false,
    });
  });

  it("recordScheduleRun stamps last_* WITHOUT advancing next_run_at (manual-run contract)", () => {
    const s = repo.createSchedule({ schedule: "every 30m", nextRunAt: "2026-06-15T09:00:00.000Z" });
    const after = repo.recordScheduleRun(s.id, {
      lastRunId: "manual_run",
      lastRunAt: "2026-06-15T09:05:00.000Z",
      lastStatus: "dispatched",
    });
    expect(after).toMatchObject({
      lastRunId: "manual_run",
      lastRunAt: "2026-06-15T09:05:00.000Z",
      lastStatus: "dispatched",
      // cadence is unchanged — next_run_at + repeat_done must NOT move
      nextRunAt: "2026-06-15T09:00:00.000Z",
      repeatDone: 0,
    });
  });

  it("deleteSchedule reports whether a row was removed", () => {
    const s = repo.createSchedule({ schedule: "every 5m" });
    expect(repo.deleteSchedule(s.id)).toBe(true);
    expect(repo.getSchedule(s.id)).toBeNull();
    expect(repo.deleteSchedule(s.id)).toBe(false);
  });

  it("deleteSchedulesForMission removes all linked schedules + returns the count", () => {
    seedMission(tdb.db, "m1");
    repo.createSchedule({ missionId: "m1", schedule: "every 5m" });
    repo.createSchedule({ missionId: "m1", schedule: "every 10m" });
    repo.createSchedule({ schedule: "every 15m" }); // unrelated (mission_id null)
    expect(repo.deleteSchedulesForMission("m1")).toBe(2);
    expect(repo.getScheduleForMission("m1")).toBeNull();
    expect(repo.listSchedules()).toHaveLength(1);
  });
});
