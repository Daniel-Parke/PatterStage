/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports -- host-scheduler is re-required under two different platform stubs, which needs a runtime require rather than a hoisted import */

// ═══════════════════════════════════════════════════════════════
// B13 oracle, group fallback-scheduler (T-0107, decision 10).
//
// Written before the product code moved. Contract sections 3.1-3.3, 4.1-4.2,
// 4.7.
//
// THE PROBLEM. The Scripts page schedules through the host crontab, and the
// real-Hermes round runs natively on Windows, where there is no crontab: the
// Schedule button has nowhere to write and the page cannot say why.
//
// THE CONTRACT. GET /api/scripts answers with `scheduler: { available, reason
// }`; where it is unavailable the Schedule modal writes a PatterStage-owned
// `schedules` row (kind 'script', script_name) and PatterStage's OWN tick runs
// it — at the honest cost, printed on the row, that it only fires while
// PatterStage is running.
//
// THE TRAP THIS FILE IS MOSTLY ABOUT. fireSchedule's first branch today is
//
//     if (!sched.missionId) { …disable, "skipped: no linked mission"… }
//
// and a script row has no mission. Without a kind branch AHEAD of it, every
// row migration 041 creates is disabled by the first tick that sees it, and
// the feature is dead on arrival while looking perfectly wired.
//
// The doubles: the repository, the runs table, the mission dispatcher and the
// script runner are all jest.fn, so what the tick DIDN'T call is as
// assertable as what it did.
// ═══════════════════════════════════════════════════════════════

import type { ScheduleRecord } from "@/lib/schedules-repository";

// ── the tick's collaborators ───────────────────────────────────

interface AdvanceFields {
  nextRunAt: string | null;
  lastRunAt: string;
  lastRunId: string | null;
  lastStatus: string | null;
  incrementDone?: boolean;
  enabled?: boolean;
}

const getDueSchedules = jest.fn<unknown[], [string]>();
const advanceSchedule = jest.fn<unknown, [string, AdvanceFields]>();
const createSchedule = jest.fn<unknown, [Record<string, unknown>]>();
const listSchedules = jest.fn<unknown[], []>(() => []);
jest.mock("@/lib/schedules-repository", () => ({
  getDueSchedules: (asOf: string) => getDueSchedules(asOf),
  advanceSchedule: (id: string, fields: AdvanceFields) => advanceSchedule(id, fields),
  createSchedule: (input: Record<string, unknown>) => createSchedule(input),
  listSchedules: () => listSchedules(),
  listScriptSchedules: () => [],
}));

const createRun = jest.fn<{ id: string } | null, [Record<string, unknown>]>();
jest.mock("@/lib/runs-repository", () => ({
  createRun: (input: Record<string, unknown>) => createRun(input),
}));

const hasDispatchedMission = jest.fn<boolean, []>();
jest.mock("@/lib/missions/mission-repository", () => ({
  hasDispatchedMission: () => hasDispatchedMission(),
}));

interface DispatchResult {
  ok: boolean;
  backendRunId?: string;
  error?: string;
}
const dispatchMissionRun = jest.fn<Promise<DispatchResult>, [string, Record<string, unknown>]>();
jest.mock("@/lib/orchestration/dispatch", () => ({
  dispatchMissionRun: (missionId: string, opts: Record<string, unknown>) =>
    dispatchMissionRun(missionId, opts),
}));

interface RunScriptResultShape {
  ok: boolean;
  exitCode: number | null;
  error?: string;
  logFile: string;
}
const listScriptFiles = jest.fn<Promise<unknown[]>, []>();
const runScriptFile = jest.fn<Promise<RunScriptResultShape>, [string]>();
jest.mock("@/lib/scripts-manager", () => ({
  listScriptFiles: () => listScriptFiles(),
  runScriptFile: (name: string) => runScriptFile(name),
}));

const recordEvent = jest.fn<void, [string, Record<string, unknown>]>();
jest.mock("@/lib/analytics/record-event", () => ({
  recordEvent: (type: string, payload: Record<string, unknown>) => recordEvent(type, payload),
}));

jest.mock("@/lib/spend/spend-guard", () => ({ checkUnattendedSpend: () => ({ allowed: true }) }));

jest.mock("@/lib/api-logger", () => ({
  ...(jest.requireActual("@/lib/api-logger") as Record<string, unknown>),
  logApiError: jest.fn(),
}));

import { runSchedulerTick } from "@/lib/orchestration/scheduler/tick";
import { GET as getScripts } from "@/app/api/scripts/route";
import { POST as postSchedule } from "@/app/api/schedules/route";
import { mockRequest } from "../helpers/api-test-helpers";

// ── fixtures ───────────────────────────────────────────────────

const NOW = new Date("2026-06-15T10:00:00.000Z");

/** Pre-B13 shim: the two fields contract 3.1 adds to a schedule row. */
type SchedRow = ScheduleRecord & { kind: "mission" | "script"; scriptName: string | null };

function sched(over: Partial<SchedRow> = {}): SchedRow {
  return {
    id: "sch-s1",
    missionId: null,
    name: "Nightly backup",
    schedule: "0 3 * * *",
    scheduleDisplay: "0 3 * * *",
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
    kind: "script",
    scriptName: "ps-db-backup.mjs",
    ...over,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  getDueSchedules.mockReturnValue([]);
  hasDispatchedMission.mockReturnValue(false);
  createRun.mockReturnValue({ id: "run1" });
  dispatchMissionRun.mockResolvedValue({ ok: true, backendRunId: "b1" });
  runScriptFile.mockResolvedValue({ ok: true, exitCode: 0, logFile: "/data/logs/x.log" });
  listScriptFiles.mockResolvedValue([]);
  createSchedule.mockImplementation((input: Record<string, unknown>) => ({
    ...sched(),
    ...input,
    id: "sch-created",
  }));
});

// ── FUSE ────────────────────────────────────────────────────────

describe("FUSE: nothing here runs a real script or writes a real row", () => {
  it("routes the runner and the repository through doubles", async () => {
    await runSchedulerTick({ now: NOW });
    expect(runScriptFile).not.toHaveBeenCalled();
    expect(getDueSchedules).toHaveBeenCalledWith(NOW.toISOString());
  });
});

// ═══════════════════════════════════════════════════════════════
// 3.3 the availability probe
// ═══════════════════════════════════════════════════════════════

interface Availability {
  available: boolean;
  reason: string;
}

function availabilityWhereWindowsIs(isWindows: boolean): Availability {
  jest.resetModules();
  jest.doMock("@/lib/platform", () => ({
    isWindows,
    isMac: false,
    isLinux: !isWindows,
    tmpDir: () => "/tmp",
    homeDir: () => "/home/op",
    interpreterFor: () => null,
  }));
  const mod = require("@/lib/host-scheduler") as {
    hostSchedulerAvailability?: () => Availability;
  };
  if (typeof mod.hostSchedulerAvailability !== "function") {
    jest.dontMock("@/lib/platform");
    jest.resetModules();
    throw new Error("host-scheduler exports no hostSchedulerAvailability (contract 3.3)");
  }
  const out = mod.hostSchedulerAvailability();
  jest.dontMock("@/lib/platform");
  jest.resetModules();
  return out;
}

describe("hostSchedulerAvailability", () => {
  it("says no, and why, on native Windows", () => {
    expect(availabilityWhereWindowsIs(true)).toEqual({
      available: false,
      reason:
        "No host scheduler on native Windows. PatterStage runs script schedules itself, while PatterStage is running.",
    });
  });

  it("says yes, and what that buys, where there is a crontab", () => {
    expect(availabilityWhereWindowsIs(false)).toEqual({
      available: true,
      reason: "Host crontab. Scheduled scripts run whether PatterStage is up or not.",
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// 4.2 GET /api/scripts tells the page which world it is in
// ═══════════════════════════════════════════════════════════════

describe("GET /api/scripts", () => {
  it("answers with the scheduler's availability beside the files", async () => {
    const res = await getScripts(mockRequest("http://127.0.0.1/api/scripts"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { scripts: unknown[]; total: number; scheduler?: Availability };
    };
    expect(Array.isArray(body.data.scripts)).toBe(true);
    expect(body.data.scheduler).toBeDefined();
    expect(typeof body.data.scheduler!.available).toBe("boolean");
    // The reason is shown to the operator verbatim, so it is never empty.
    expect(body.data.scheduler!.reason.length).toBeGreaterThan(10);
  });
});

// ═══════════════════════════════════════════════════════════════
// 4.7 POST /api/schedules accepts a script row
// ═══════════════════════════════════════════════════════════════

function scheduleRequest(body: Record<string, unknown>) {
  return mockRequest("http://127.0.0.1/api/schedules", "POST", body);
}

describe("POST /api/schedules", () => {
  it("GREEN CONTROL: a mission schedule still creates a mission schedule", async () => {
    const res = await postSchedule(scheduleRequest({ missionId: "m1", schedule: "0 3 * * *" }));
    expect(res.status).toBe(201);
    expect(createSchedule).toHaveBeenCalledWith(expect.objectContaining({ missionId: "m1" }));
  });

  it("creates a script schedule from kind + scriptName", async () => {
    const res = await postSchedule(
      scheduleRequest({
        kind: "script",
        scriptName: "ps-db-backup.mjs",
        name: "Ps Db Backup",
        schedule: "0 3 * * *",
        scheduleDisplay: "0 3 * * *",
      }),
    );
    expect(res.status).toBe(201);
    expect(createSchedule).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "script", scriptName: "ps-db-backup.mjs" }),
    );
  });

  it("refuses a script schedule with no script to run", async () => {
    const res = await postSchedule(scheduleRequest({ kind: "script", schedule: "0 3 * * *" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("scriptName is required for a script schedule");
    expect(createSchedule).not.toHaveBeenCalled();
  });

  it("refuses a mission schedule with no mission", async () => {
    const res = await postSchedule(scheduleRequest({ schedule: "0 3 * * *" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("missionId is required for a mission schedule");
    expect(createSchedule).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════
// 3.2 the tick runs a script row
// ═══════════════════════════════════════════════════════════════

describe("the scheduler tick, on a script schedule", () => {
  it("runs the script the row names", async () => {
    getDueSchedules.mockReturnValue([sched()]);
    const res = await runSchedulerTick({ now: NOW });
    expect(runScriptFile).toHaveBeenCalledWith("ps-db-backup.mjs");
    expect(res.fired).toBe(1);
  });

  it("does not treat a script row as an orphaned mission", async () => {
    getDueSchedules.mockReturnValue([sched()]);
    await runSchedulerTick({ now: NOW });
    expect(advanceSchedule).not.toHaveBeenCalledWith(
      "sch-s1",
      expect.objectContaining({ lastStatus: "skipped: no linked mission" }),
    );
    expect(advanceSchedule).toHaveBeenCalledWith(
      "sch-s1",
      expect.objectContaining({ lastStatus: "ran", incrementDone: true }),
    );
  });

  it("advances to a next occurrence instead of disabling itself", async () => {
    getDueSchedules.mockReturnValue([sched()]);
    await runSchedulerTick({ now: NOW });
    const [, fields] = advanceSchedule.mock.calls[0];
    expect(fields.nextRunAt).not.toBeNull();
    expect(fields.enabled).not.toBe(false);
  });

  it("is not an agent run: no run row is claimed and no mission is dispatched", async () => {
    getDueSchedules.mockReturnValue([sched()]);
    await runSchedulerTick({ now: NOW });
    expect(createRun).not.toHaveBeenCalled();
    expect(dispatchMissionRun).not.toHaveBeenCalled();
  });

  it("is not held behind the mission single-flight", async () => {
    hasDispatchedMission.mockReturnValue(true);
    getDueSchedules.mockReturnValue([sched()]);
    const res = await runSchedulerTick({ now: NOW });
    expect(runScriptFile).toHaveBeenCalledWith("ps-db-backup.mjs");
    expect(res.fired).toBe(1);
  });

  it("records the run so the operator's history shows it", async () => {
    getDueSchedules.mockReturnValue([sched()]);
    await runSchedulerTick({ now: NOW });
    expect(recordEvent).toHaveBeenCalledWith(
      "script.run",
      expect.objectContaining({ entityType: "script", entityId: "ps-db-backup.mjs" }),
    );
  });

  it("a failed script advances with the failure, and does not count as fired", async () => {
    runScriptFile.mockResolvedValue({ ok: false, exitCode: 1, error: "boom", logFile: "/l" });
    getDueSchedules.mockReturnValue([sched()]);
    const res = await runSchedulerTick({ now: NOW });
    expect(res.fired).toBe(0);
    expect(advanceSchedule).toHaveBeenCalledWith(
      "sch-s1",
      expect.objectContaining({ lastStatus: "error: boom", incrementDone: true }),
    );
    // And no event claims it ran. The ledger is what the operator reads to
    // decide whether the backup happened.
    expect(recordEvent).not.toHaveBeenCalledWith("script.run", expect.anything());
  });

  it("a script row that names no script disables itself, and says so", async () => {
    getDueSchedules.mockReturnValue([sched({ scriptName: null })]);
    const res = await runSchedulerTick({ now: NOW });
    expect(res.fired).toBe(0);
    expect(runScriptFile).not.toHaveBeenCalled();
    expect(advanceSchedule).toHaveBeenCalledWith(
      "sch-s1",
      expect.objectContaining({ enabled: false, nextRunAt: null, lastStatus: "skipped: no script named" }),
    );
  });

  it("honours catch-up 'skip' the same way a mission does", async () => {
    getDueSchedules.mockReturnValue([
      sched({ catchUpPolicy: "skip", nextRunAt: "2026-06-15T08:00:00.000Z" }),
    ]);
    const res = await runSchedulerTick({ now: NOW });
    expect(res.fired).toBe(0);
    expect(runScriptFile).not.toHaveBeenCalled();
    expect(advanceSchedule).toHaveBeenCalledWith(
      "sch-s1",
      expect.objectContaining({ lastStatus: "skipped (catch-up)" }),
    );
  });

  it("GREEN CONTROL: a mission row still goes down the mission path", async () => {
    getDueSchedules.mockReturnValue([sched({ kind: "mission", missionId: "m1", scriptName: null })]);
    const res = await runSchedulerTick({ now: NOW });
    expect(dispatchMissionRun).toHaveBeenCalled();
    expect(runScriptFile).not.toHaveBeenCalled();
    expect(res.fired).toBe(1);
  });
});
