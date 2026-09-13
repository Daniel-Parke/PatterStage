/**
 * @jest-environment node
 *
 * A schedule row is a promise to run SOMETHING, and the list never said what.
 *
 * Two halves, both here:
 *
 *   1. The list read returns the row and nothing else, so a client showing
 *      schedules has the mission's id at best and usually only the schedule's
 *      own nickname. Two rows called "Nightly" are indistinguishable.
 *   2. Since the script kind landed, a row can fire a host script instead of a
 *      mission, and nothing in the payload or the copy tells the two apart.
 *
 * The contract: the list carries the name of the mission each row fires, and
 * one helper turns a row into the pair of words a screen shows -- what kind of
 * thing it runs, and which one.
 *
 * Real SQLite, because the mission name comes from a join and a double would
 * answer for it.
 */
/* eslint-disable @typescript-eslint/no-require-imports -- better-sqlite3's package root is not newable under the jest transform */

import type DatabaseNs from "better-sqlite3";
import type * as SchedulesRepo from "@/lib/schedule/schedules-repository";

import { openBaselineDb } from "../helpers/baseline-db";
import { describeScheduleTarget } from "@/lib/schedule/schedule-target";

type RealDb = DatabaseNs.Database;
let testDb: RealDb | null = null;
let repo: typeof SchedulesRepo;

function seedMission(db: RealDb, id: string, name: string, deleted = false): void {
  db.prepare(
    `INSERT INTO missions (id, name, prompt, status, created_at, updated_at, deleted_at)
     VALUES (?, ?, '<hermes_mission></hermes_mission>', 'queued', datetime('now'), datetime('now'), ?)`,
  ).run(id, name, deleted ? new Date().toISOString() : null);
}

beforeEach(() => {
  testDb = openBaselineDb();
  jest.resetModules();
  jest.doMock("@/lib/db", () => {
    const actual = jest.requireActual("@/lib/db");
    return { ...actual, getDb: () => testDb!, inTransaction: (fn: () => unknown) => fn() };
  });
  repo = require("@/lib/schedule/schedules-repository") as typeof SchedulesRepo;
});

afterEach(() => {
  testDb?.close();
  testDb = null;
});

describe("the schedule list carries the mission each row fires", () => {
  it("names the mission, not just its id", () => {
    seedMission(testDb!, "m_1", "Nightly digest");
    repo.createSchedule({ missionId: "m_1", name: "Nightly", schedule: "every 30m" });

    const [row] = repo.listSchedules();

    expect(row.missionId).toBe("m_1");
    expect(row.missionName).toBe("Nightly digest");
  });

  it("leaves the name null for a script row, which has no mission", () => {
    repo.createSchedule({
      kind: "script",
      scriptName: "ps-db-backup.mjs",
      name: "Ps Db Backup",
      schedule: "0 3 * * *",
    });

    const [row] = repo.listSchedules();

    expect(row.kind).toBe("script");
    expect(row.scriptName).toBe("ps-db-backup.mjs");
    expect(row.missionName).toBeNull();
  });

  it("leaves the name null when the mission has been deleted", () => {
    seedMission(testDb!, "m_gone", "Deleted mission", true);
    repo.createSchedule({ missionId: "m_gone", name: "Orphan", schedule: "every 1h" });

    const [row] = repo.listSchedules();

    expect(row.missionId).toBe("m_gone");
    expect(row.missionName).toBeNull();
  });
});

describe("the two words a screen shows for a schedule", () => {
  it("says Mission and names it", () => {
    expect(
      describeScheduleTarget({
        kind: "mission",
        missionId: "m_1",
        missionName: "Nightly digest",
        scriptName: null,
      }),
    ).toEqual({ kindLabel: "Mission", name: "Nightly digest", missing: false });
  });

  it("says Script and names the file", () => {
    expect(
      describeScheduleTarget({
        kind: "script",
        missionId: null,
        missionName: null,
        scriptName: "ps-db-backup.mjs",
      }),
    ).toEqual({ kindLabel: "Script", name: "ps-db-backup.mjs", missing: false });
  });

  it("says so when the mission it names is gone", () => {
    const target = describeScheduleTarget({
      kind: "mission",
      missionId: "m_gone",
      missionName: null,
      scriptName: null,
    });

    expect(target.kindLabel).toBe("Mission");
    expect(target.name).toBe("Mission not found");
    expect(target.missing).toBe(true);
  });

  it("says so when the row names nothing at all", () => {
    expect(
      describeScheduleTarget({ kind: "mission", missionId: null, missionName: null, scriptName: null }),
    ).toEqual({ kindLabel: "Mission", name: "No mission linked", missing: true });
    expect(
      describeScheduleTarget({ kind: "script", missionId: null, missionName: null, scriptName: null }),
    ).toEqual({ kindLabel: "Script", name: "No script linked", missing: true });
  });
});
