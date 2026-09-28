/** @jest-environment node */

// T-0183: one cron occurrence retains its identity while its owner awaits the gateway.
import { openBaselineDb } from "../helpers/baseline-db";
import { applyMissionQueueMigration } from "@/lib/db/apply-mission-queue-migration";
import type { RunHandle, RunSubmit } from "@/lib/runtime/types";

let scheduleDb: import("better-sqlite3").Database | null = null;
const requestRun = jest.fn<Promise<RunHandle>, [RunSubmit]>();
const sentEvent = jest.fn();

// eslint-disable-next-line @typescript-eslint/no-require-imports -- Jest hoists its mock factories
jest.mock("@/lib/db", () => require("../helpers/baseline-db").dbSingletonMock(() => scheduleDb));
jest.mock("@/lib/runtime", () => ({ runtime: { submitRun: (request: RunSubmit) => requestRun(request) } }));
jest.mock("@/lib/spend/spend-guard", () => ({ checkUnattendedSpend: () => ({ allowed: true }) }));
jest.mock("@/lib/analytics/record-event", () => ({ recordEvent: (...args: unknown[]) => sentEvent(...args) }));
jest.mock("@/lib/api/api-logger", () => ({ logApiError: jest.fn() }));

import { createMission } from "@/lib/missions/mission-repository";
import { createSchedule, getSchedule } from "@/lib/schedule/schedules-repository";
import { runSchedulerTick } from "@/lib/orchestration/scheduler/tick";

const dueAt = "2026-09-28T09:00:00.000Z";
const tickAt = new Date("2026-09-28T09:01:00.000Z");

beforeEach(() => {
  scheduleDb = openBaselineDb([applyMissionQueueMigration]);
  jest.clearAllMocks();
});

afterEach(() => { scheduleDb?.close(); scheduleDb = null; });

it("keeps a duplicate occurrence due until its owner receives the gateway acknowledgement", async () => {
  const mission = createMission({ name: "Cron contention", prompt: "One paid occurrence" });
  const schedule = createSchedule({
    missionId: mission.id,
    schedule: "every 30m",
    nextRunAt: dueAt,
    repeatTimes: 2,
  });
  let acknowledge!: (handle: RunHandle) => void;
  let entered!: () => void;
  const submitted = new Promise<void>((resolve) => { entered = resolve; });
  requestRun.mockImplementation(() => {
    entered();
    return new Promise<RunHandle>((resolve) => { acknowledge = resolve; });
  });

  const first = runSchedulerTick({ now: tickAt });
  await submitted;
  const ownedRun = scheduleDb!.prepare(
    "SELECT id, status FROM runs WHERE schedule_id = ?",
  ).get(schedule.id) as { id: string; status: string };
  const duplicate = await runSchedulerTick({ now: tickAt });
  const stillDue = getSchedule(schedule.id)!;

  expect(duplicate.fired).toBe(0);
  expect(stillDue.nextRunAt).toBe(dueAt);
  expect(stillDue.repeatDone).toBe(0);
  expect(stillDue.lastStatus ?? "").not.toMatch(/duplicate|finished/i);
  expect(ownedRun.id).toBe(`sch_${schedule.id}_${dueAt}`);
  expect(requestRun).toHaveBeenCalledTimes(1);

  acknowledge({ runId: "backend-cron", status: "started" });
  expect((await first).fired).toBe(1);
  const advanced = getSchedule(schedule.id)!;
  const ids = scheduleDb!.prepare("SELECT id FROM runs WHERE schedule_id = ?")
    .all(schedule.id) as Array<{ id: string }>;
  expect(advanced.repeatDone).toBe(1);
  expect(advanced.nextRunAt).not.toBe(dueAt);
  expect(ids.map(({ id }) => id)).toEqual([ownedRun.id]);
  expect(sentEvent.mock.calls.filter(([name]) => name === "schedule.fired")).toHaveLength(1);
});
