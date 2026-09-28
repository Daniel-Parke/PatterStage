/** @jest-environment node */

/**
 * Tests for the PatterStage-owned scheduler tick
 * (src/lib/orchestration/scheduler/tick.ts). The tick's branches (ownership,
 * orphan, catch-up, single-flight, exactly-once claim, dispatch, exhausted
 * repeats) are driven by mocking the repository + mission + dispatch
 * collaborators and asserting the advance/dispatch calls. `computeNextRun` is
 * left real (it's covered by next-run.test.ts).
 */

import { makeSchedule } from "../helpers/schedule-record-fixture";

const getDueSchedules = jest.fn();
const advanceSchedule = jest.fn();
const reserveMissionRun = jest.fn();
const dispatchMissionRun = jest.fn();

jest.mock("@/lib/schedule/schedules-repository", () => ({
  getDueSchedules: (...a: unknown[]) => getDueSchedules(...a),
  advanceSchedule: (...a: unknown[]) => advanceSchedule(...a),
}));
jest.mock("@/lib/missions/mission-repository", () => ({
  reserveMissionRun: (...a: unknown[]) => reserveMissionRun(...a),
}));
jest.mock("@/lib/orchestration/dispatch", () => ({
  dispatchMissionRun: (...a: unknown[]) => dispatchMissionRun(...a),
}));
jest.mock("@/lib/api/api-logger", () => ({ logApiError: jest.fn() }));

import { runSchedulerTick } from "@/lib/orchestration/scheduler/tick";

const NOW = new Date("2026-06-15T10:00:00.000Z");

beforeEach(() => {
  jest.clearAllMocks();
  reserveMissionRun.mockReturnValue({ kind: "claimed", missionId: "m1", runId: "sch_sch1_2026-06-15T10:00:00.000Z" });
  dispatchMissionRun.mockResolvedValue({ ok: true, backendRunId: "b1", runId: "sch_sch1_2026-06-15T10:00:00.000Z" });
});

it("does nothing when this process is not the owner", async () => {
  const res = await runSchedulerTick({ isOwner: false, now: NOW });
  expect(res).toEqual({ fired: 0 });
  expect(getDueSchedules).not.toHaveBeenCalled();
  expect(dispatchMissionRun).not.toHaveBeenCalled();
});

it("disables an orphaned schedule (no linked mission) without firing", async () => {
  getDueSchedules.mockReturnValue([makeSchedule({ missionId: null })]);
  const res = await runSchedulerTick({ now: NOW });
  expect(res.fired).toBe(0);
  expect(dispatchMissionRun).not.toHaveBeenCalled();
  expect(advanceSchedule).toHaveBeenCalledWith(
    "sch1",
    expect.objectContaining({ enabled: false, nextRunAt: null, lastStatus: "skipped: no linked mission" }),
  );
});

it("catch-up 'skip' past the grace window advances without firing", async () => {
  getDueSchedules.mockReturnValue([
    makeSchedule({ catchUpPolicy: "skip", nextRunAt: "2026-06-15T09:00:00.000Z" }), // 1h late
  ]);
  const res = await runSchedulerTick({ now: NOW });
  expect(res.fired).toBe(0);
  expect(dispatchMissionRun).not.toHaveBeenCalled();
  expect(advanceSchedule).toHaveBeenCalledWith(
    "sch1",
    expect.objectContaining({ lastStatus: "skipped (catch-up)" }),
  );
});

it("single-flight: skips entirely when a mission is already dispatched (leaves next_run_at)", async () => {
  reserveMissionRun.mockReturnValue({ kind: "busy" });
  getDueSchedules.mockReturnValue([makeSchedule()]);
  const res = await runSchedulerTick({ now: NOW });
  expect(res.fired).toBe(0);
  expect(reserveMissionRun).toHaveBeenCalledWith({
    kind: "schedule",
    missionId: "m1",
    runId: "sch_sch1_2026-06-15T10:00:00.000Z",
    scheduleId: "sch1",
    profileName: null,
  });
  expect(dispatchMissionRun).not.toHaveBeenCalled();
  expect(advanceSchedule).not.toHaveBeenCalled();
});

it("exactly-once: a duplicate claim (createRun -> null) advances without re-dispatching", async () => {
  reserveMissionRun.mockReturnValue({ kind: "duplicate" });
  getDueSchedules.mockReturnValue([makeSchedule()]);
  const res = await runSchedulerTick({ now: NOW });
  expect(res.fired).toBe(0);
  expect(reserveMissionRun).toHaveBeenCalledWith({
    kind: "schedule",
    missionId: "m1",
    runId: "sch_sch1_2026-06-15T10:00:00.000Z",
    scheduleId: "sch1",
    profileName: null,
  });
  expect(dispatchMissionRun).not.toHaveBeenCalled();
  expect(advanceSchedule).toHaveBeenCalledWith(
    "sch1",
    expect.objectContaining({ lastStatus: "duplicate occurrence" }),
  );
});

it("happy path: claims, dispatches, advances with incrementDone + 'dispatched'", async () => {
  getDueSchedules.mockReturnValue([makeSchedule()]);
  const res = await runSchedulerTick({ now: NOW });
  expect(res.fired).toBe(1);
  expect(reserveMissionRun).toHaveBeenCalledWith({
    kind: "schedule",
    missionId: "m1",
    runId: "sch_sch1_2026-06-15T10:00:00.000Z",
    scheduleId: "sch1",
    profileName: null,
  });
  expect(dispatchMissionRun).toHaveBeenCalledWith("m1", {
    runId: "sch_sch1_2026-06-15T10:00:00.000Z",
    scheduleId: "sch1",
  });
  expect(advanceSchedule).toHaveBeenCalledWith(
    "sch1",
    expect.objectContaining({ incrementDone: true, lastStatus: "dispatched", lastRunId: "b1" }),
  );
});

it("dispatch error still advances (incrementDone) with an error status, fired stays 0", async () => {
  dispatchMissionRun.mockResolvedValue({ ok: false, error: "boom" });
  getDueSchedules.mockReturnValue([makeSchedule()]);
  const res = await runSchedulerTick({ now: NOW });
  expect(res.fired).toBe(0);
  expect(advanceSchedule).toHaveBeenCalledWith(
    "sch1",
    expect.objectContaining({ incrementDone: true, lastStatus: "error: boom" }),
  );
});

it("exhausted finite schedule disables itself (nextRunAt null, enabled false)", async () => {
  getDueSchedules.mockReturnValue([makeSchedule({ repeatTimes: 1, repeatDone: 0 })]);
  const res = await runSchedulerTick({ now: NOW });
  expect(res.fired).toBe(1);
  expect(advanceSchedule).toHaveBeenCalledWith(
    "sch1",
    expect.objectContaining({ nextRunAt: null, enabled: false, incrementDone: true }),
  );
});
