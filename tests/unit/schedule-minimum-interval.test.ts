/** @jest-environment node */

// An interval schedule with no interval is a money incinerator.
//
// `every 0m` parses cleanly as `{ kind: "interval", minutes: 0 }`, so every
// write path stores it, and `computeNextRun` answers "now" for it forever: the
// row is due on every tick, every tick dispatches a real agent run at a paid
// provider, and nothing anywhere says a word. The same shape at the other end
// (`every 999999999d`) overflows the Date range, so the advance throws AFTER
// the dispatch and the row never leaves the due set either.
//
// Cron cannot express either of these -- the evaluator steps in whole minutes,
// so `* * * * *` is already the fastest thing it can say -- which is why the
// floor lives with the interval parse rather than in the cron checker.

const listSchedules = jest.fn();
const createSchedule = jest.fn();
const getSchedule = jest.fn();
const updateSchedule = jest.fn();
const deleteSchedule = jest.fn();
const recordScheduleRun = jest.fn();
const getDueSchedules = jest.fn();
const advanceSchedule = jest.fn();
const createRun = jest.fn();
const hasDispatchedMission = jest.fn();
const dispatchMissionRun = jest.fn();

jest.mock("@/lib/schedule/schedules-repository", () => ({
  listSchedules: (...a: unknown[]) => listSchedules(...a),
  createSchedule: (...a: unknown[]) => createSchedule(...a),
  getSchedule: (...a: unknown[]) => getSchedule(...a),
  updateSchedule: (...a: unknown[]) => updateSchedule(...a),
  deleteSchedule: (...a: unknown[]) => deleteSchedule(...a),
  recordScheduleRun: (...a: unknown[]) => recordScheduleRun(...a),
  getDueSchedules: (...a: unknown[]) => getDueSchedules(...a),
  advanceSchedule: (...a: unknown[]) => advanceSchedule(...a),
}));
jest.mock("@/lib/api/api-auth", () => ({ requireAuth: () => null }));
jest.mock("@/lib/runs/runs-repository", () => ({ createRun: (...a: unknown[]) => createRun(...a) }));
jest.mock("@/lib/missions/mission-repository", () => ({
  hasDispatchedMission: (...a: unknown[]) => hasDispatchedMission(...a),
}));
jest.mock("@/lib/orchestration/dispatch", () => ({
  dispatchMissionRun: (...a: unknown[]) => dispatchMissionRun(...a),
}));
jest.mock("@/lib/spend/spend-guard", () => ({ checkUnattendedSpend: () => ({ allowed: true }) }));
jest.mock("@/lib/analytics/record-event", () => ({ recordEvent: jest.fn() }));
// A 500 must be visible as a 500 rather than as a thrown mock, because "the
// write path answers 500 instead of refusing" is one of the defects here.
jest.mock("@/lib/api/api-logger", () => ({
  logApiError: jest.fn(),
  serverErrorFromCatch: () =>
    new Response(JSON.stringify({ error: "server error" }), { status: 500 }),
}));

import type { NextRequest } from "next/server";
import type { ScheduleRecord } from "@/lib/schedule/schedules-repository";

import { POST as createPOST } from "@/app/api/schedules/route";
import { PATCH as idPATCH } from "@/app/api/schedules/[id]/route";
import { runSchedulerTick } from "@/lib/orchestration/scheduler/tick";
import { computeNextRun } from "@/lib/schedule/next-run";
import { parseSchedule } from "@/lib/schedule/parse-schedule";
import { advancedDraftProblem } from "@/lib/schedule/picker-resolver";
import {
  MIN_SCHEDULE_INTERVAL_MINUTES,
  scheduleIntervalProblem,
} from "@/lib/schedule/interval-bounds";

function req(body?: unknown): NextRequest {
  return { json: async () => body ?? {} } as unknown as NextRequest;
}
function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}
async function errorOf(res: Response): Promise<string> {
  return ((await res.json()) as { error?: string }).error ?? "";
}

const NOW = new Date("2026-06-15T10:00:00.000Z");

function makeSchedule(over: Partial<ScheduleRecord> = {}): ScheduleRecord {
  return {
    id: "sch1",
    kind: "mission",
    scriptName: null,
    missionId: "m1",
    name: "S",
    schedule: "every 30m",
    scheduleDisplay: "every 30m",
    enabled: true,
    catchUpPolicy: "fire_once",
    repeatTimes: null,
    repeatDone: 0,
    profileName: null,
    nextRunAt: "2026-06-15T10:00:00.000Z",
    lastRunAt: null,
    lastRunId: null,
    lastStatus: null,
    createdAt: "2026-06-15T09:00:00.000Z",
    updatedAt: "2026-06-15T09:00:00.000Z",
    ...over,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  createSchedule.mockReturnValue({ id: "sch1", profileName: null });
  getSchedule.mockReturnValue({ id: "sch1" });
  updateSchedule.mockReturnValue({ id: "sch1" });
  hasDispatchedMission.mockReturnValue(false);
  createRun.mockReturnValue({ id: "run1" });
  dispatchMissionRun.mockResolvedValue({ ok: true, backendRunId: "b1", runId: "run1" });
});

describe("the interval floor", () => {
  it.each(["every 0m", "0m", "every 0h", "every 0d"])(
    "refuses %s, and says what the minimum is",
    (expr) => {
      const problem = scheduleIntervalProblem(expr);
      expect(problem).not.toBeNull();
      expect(problem).toContain("1 minute");
    },
  );

  it("refuses an interval so long the date arithmetic overflows", () => {
    // Not pedantry: `new Date(now + 999999999d)` is an Invalid Date, and
    // `.toISOString()` on one throws, so this used to be a 500 on write and a
    // dispatch-then-throw on the tick.
    expect(scheduleIntervalProblem("every 999999999d")).not.toBeNull();
  });

  it.each([
    ["every 1m", "the floor itself"],
    ["every 5m", "a sane interval"],
    ["every 2h", "hours"],
    ["every 7d", "a week"],
    ["* * * * *", "cron every minute, the fastest cron can say"],
    ["*/5 * * * *", "cron every five minutes"],
    ["0 9 * * *", "cron daily"],
    ["2027-01-01T09:00:00Z", "a one-shot"],
  ])("GREEN CONTROL: accepts %s (%s)", (expr) => {
    expect(scheduleIntervalProblem(expr)).toBeNull();
  });

  it("does not judge a schedule it cannot parse, which the parse check refuses first", () => {
    // Negative and unit-less forms never reach the floor: the digits-only
    // regex in parseSchedule rejects them outright.
    expect(parseSchedule("every -5m").kind).toBe("invalid");
    expect(parseSchedule("every 5").kind).toBe("invalid");
    expect(parseSchedule("every 0s").kind).toBe("invalid");
    expect(scheduleIntervalProblem("every -5m")).toBeNull();
  });

  it("keeps the floor at one minute", () => {
    expect(MIN_SCHEDULE_INTERVAL_MINUTES).toBe(1);
  });
});

describe("computeNextRun refuses to answer 'now, forever'", () => {
  it("returns null for a zero interval rather than the instant it was asked about", () => {
    expect(computeNextRun("every 0m", NOW)).toBeNull();
  });

  it("returns null rather than an Invalid Date for an absurd interval", () => {
    expect(computeNextRun("every 999999999d", NOW)).toBeNull();
  });

  it("GREEN CONTROL: still advances a real interval", () => {
    expect(computeNextRun("every 1m", NOW)?.toISOString()).toBe("2026-06-15T10:01:00.000Z");
    expect(computeNextRun("every 30m", NOW)?.toISOString()).toBe("2026-06-15T10:30:00.000Z");
  });
});

describe("POST /api/schedules refuses a schedule with no interval", () => {
  it("400s on every 0m and stores nothing", async () => {
    const res = await createPOST(req({ missionId: "m1", schedule: "every 0m" }));
    expect(res.status).toBe(400);
    expect(await errorOf(res)).toContain("1 minute");
    expect(createSchedule).not.toHaveBeenCalled();
  });

  it("400s on an absurd interval rather than answering 500", async () => {
    const res = await createPOST(req({ missionId: "m1", schedule: "every 999999999d" }));
    expect(res.status).toBe(400);
    expect(createSchedule).not.toHaveBeenCalled();
  });

  it("400s on a negative interval", async () => {
    const res = await createPOST(req({ missionId: "m1", schedule: "every -5m" }));
    expect(res.status).toBe(400);
    expect(createSchedule).not.toHaveBeenCalled();
  });

  it("GREEN CONTROL: still creates a one-minute schedule", async () => {
    const res = await createPOST(req({ missionId: "m1", schedule: "every 1m" }));
    expect(res.status).toBe(201);
    expect(createSchedule).toHaveBeenCalledTimes(1);
  });
});

describe("PATCH /api/schedules/[id] refuses the same", () => {
  it("400s on every 0m and updates nothing", async () => {
    const res = await idPATCH(req({ schedule: "every 0m" }), ctx("sch1"));
    expect(res.status).toBe(400);
    expect(await errorOf(res)).toContain("1 minute");
    expect(updateSchedule).not.toHaveBeenCalled();
  });

  it("GREEN CONTROL: still accepts a real interval", async () => {
    const res = await idPATCH(req({ schedule: "every 15m" }), ctx("sch1"));
    expect(res.status).toBe(200);
    expect(updateSchedule).toHaveBeenCalledTimes(1);
  });
});

describe("a stored bad schedule cannot spin the tick", () => {
  it("does not dispatch a zero-interval row, and stops selecting it", async () => {
    getDueSchedules.mockReturnValue([makeSchedule({ schedule: "every 0m", scheduleDisplay: "every 0m" })]);

    const res = await runSchedulerTick({ now: NOW });

    expect(res.fired).toBe(0);
    expect(dispatchMissionRun).not.toHaveBeenCalled();
    expect(createRun).not.toHaveBeenCalled();
    expect(advanceSchedule).toHaveBeenCalledWith(
      "sch1",
      expect.objectContaining({ enabled: false, nextRunAt: null }),
    );
    expect(advanceSchedule.mock.calls[0][1].lastStatus).toMatch(/too often/i);
  });

  it("does not dispatch a row whose interval overflows the calendar", async () => {
    // This one dispatched FIRST and threw on the advance, so the row stayed due
    // and every later tick dispatched it again.
    getDueSchedules.mockReturnValue([makeSchedule({ schedule: "every 999999999d" })]);

    const res = await runSchedulerTick({ now: NOW });

    expect(res.fired).toBe(0);
    expect(dispatchMissionRun).not.toHaveBeenCalled();
    expect(advanceSchedule).toHaveBeenCalledWith(
      "sch1",
      expect.objectContaining({ enabled: false, nextRunAt: null }),
    );
  });

  it("does not run a zero-interval SCRIPT row either", async () => {
    getDueSchedules.mockReturnValue([
      makeSchedule({ kind: "script", missionId: null, scriptName: "backup.sh", schedule: "every 0m" }),
    ]);

    const res = await runSchedulerTick({ now: NOW });

    expect(res.fired).toBe(0);
    expect(advanceSchedule).toHaveBeenCalledWith(
      "sch1",
      expect.objectContaining({ enabled: false, nextRunAt: null }),
    );
  });

  it("GREEN CONTROL: a real interval still fires", async () => {
    getDueSchedules.mockReturnValue([makeSchedule()]);

    const res = await runSchedulerTick({ now: NOW });

    expect(res.fired).toBe(1);
    expect(dispatchMissionRun).toHaveBeenCalledTimes(1);
  });
});

describe("the picker refuses it before the request is sent", () => {
  it("reports a zero interval as a problem with the draft", () => {
    const problem = advancedDraftProblem("every 0m");
    expect(problem).not.toBeNull();
    expect(problem).toContain("1 minute");
  });

  it("GREEN CONTROL: leaves a usable draft alone", () => {
    expect(advancedDraftProblem("every 5m")).toBeNull();
    expect(advancedDraftProblem("*/5 * * * *")).toBeNull();
  });
});
