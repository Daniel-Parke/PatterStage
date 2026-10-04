/** @jest-environment node */
/* Jest hoists the database mock. */

import { applyMissionQueueMigration } from "@/lib/db/apply-mission-queue-migration";
import { openBaselineDb } from "../helpers/baseline-db";

let testDb: import("better-sqlite3").Database | null = null;

jest.mock("@/lib/db", () => require("../helpers/baseline-db").dbSingletonMock(() => testDb));
jest.mock("@/lib/missions/mission-dispatch", () => ({ dispatchMissionNow: jest.fn() }));
jest.mock("@/lib/missions/mission-queue-tick", () => ({ runMissionQueueTick: jest.fn() }));
jest.mock("@/lib/api/api-logger", () => ({ logApiError: jest.fn() }));

import { promoteMission } from "@/lib/missions/mission-promote-handler";
import { getMission } from "@/lib/missions/mission-repository";
import { dispatchMissionNow } from "@/lib/missions/mission-dispatch";
import { runMissionQueueTick } from "@/lib/missions/mission-queue-tick";

type MissionRow = Record<string, unknown>;
type ScheduleRow = Record<string, unknown>;

function seedMission(queuedForRun: boolean): void {
  testDb!.prepare(`
    INSERT INTO missions
      (id, name, prompt, status, result, schedule, queued_for_run, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    "mission-1", "Original name", "<hermes_mission><instruction>Original instruction</instruction></hermes_mission>",
    "queued", "Previous result", "every 1d", queuedForRun ? 1 : 0,
    "2026-09-01T00:00:00.000Z", "2026-09-02T00:00:00.000Z",
  );
}

function missionRow(): MissionRow {
  return testDb!.prepare("SELECT * FROM missions WHERE id = ?").get("mission-1") as MissionRow;
}

function scheduleRows(): ScheduleRow[] {
  return testDb!.prepare("SELECT * FROM schedules WHERE mission_id = ? ORDER BY id").all("mission-1") as ScheduleRow[];
}

beforeEach(() => {
  testDb = openBaselineDb([applyMissionQueueMigration]);
  jest.clearAllMocks();
});

afterEach(() => {
  testDb?.close();
  testDb = null;
});

describe("cron promotion preserves mission state", () => {
  it.each([
    ["queued", true],
    ["draft", false],
  ])("%s-to-cron clears the queue flag and schedules without dispatching", async (_state, queuedForRun) => {
    seedMission(queuedForRun);

    const result = await promoteMission({
      missionId: "mission-1",
      dispatchMode: "cron",
      schedule: "every 30m",
    });

    expect(result.ok).toBe(true);
    expect(getMission("mission-1")?.queuedForRun).toBe(false);
    expect(scheduleRows()).toEqual([
      expect.objectContaining({ mission_id: "mission-1", schedule: "every 30m", enabled: 1 }),
    ]);
    expect(dispatchMissionNow).not.toHaveBeenCalled();
    expect(runMissionQueueTick).not.toHaveBeenCalled();
    expect(testDb!.prepare("SELECT COUNT(*) AS count FROM runs WHERE mission_id = ?").get("mission-1"))
      .toEqual({ count: 0 });
  });

  it.each([
    ["invalid syntax", "not a cron"],
    ["impossible date", "0 0 31 2 *"],
    ["below minimum interval", "every 0m"],
  ])("rejects %s before changing any mission column or schedule row", async (_case, schedule) => {
    seedMission(true);
    testDb!.prepare("INSERT INTO schedules (id, mission_id, name, schedule) VALUES (?, ?, ?, ?)")
      .run("original-schedule", "mission-1", "Original name", "every 1d");
    const beforeMission = missionRow();
    const beforeSchedules = scheduleRows();

    const result = await promoteMission({
      missionId: "mission-1",
      dispatchMode: "cron",
      schedule,
      name: "Attempted new name",
      instruction: "Attempted new instruction",
    });

    expect(result).toMatchObject({ ok: false, status: 400 });
    expect(missionRow()).toEqual(beforeMission);
    expect(scheduleRows()).toEqual(beforeSchedules);
    expect(dispatchMissionNow).not.toHaveBeenCalled();
    expect(runMissionQueueTick).not.toHaveBeenCalled();
  });

  it("preserves the mission when the database rejects schedule insertion", async () => {
    seedMission(true);
    testDb!.exec(`
      CREATE TRIGGER reject_new_schedule BEFORE INSERT ON schedules
      BEGIN SELECT RAISE(ABORT, 'injected schedule insert failure'); END;
    `);
    const beforeMission = missionRow();
    const beforeSchedules = scheduleRows();

    const result = await promoteMission({
      missionId: "mission-1",
      dispatchMode: "cron",
      schedule: "every 30m",
      name: "Attempted new name",
      instruction: "Attempted new instruction",
    });

    expect(result).toMatchObject({ ok: false, status: 500 });
    expect(missionRow()).toEqual(beforeMission);
    expect(scheduleRows()).toEqual(beforeSchedules);
    expect(dispatchMissionNow).not.toHaveBeenCalled();
  });
});
