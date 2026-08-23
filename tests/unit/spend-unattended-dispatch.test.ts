/** @jest-environment node */
// ORACLE for T-0021 (WO-0014), part 4 of 4: where the gate is, and where it is not.
//
// Clause 4: "when it is on and the figure is breached, UNATTENDED dispatch stops
// and says why". Clause 5: "attended use is never blocked. A human clicking
// dispatch is answering for the spend himself."
//
// There are exactly three places in this codebase that dispatch work with no
// human in the loop, and all three run off the BackgroundScheduler:
//
//   src/lib/orchestration/scheduler/tick.ts   a schedule falling due;
//   src/lib/missions/mission-queue-tick.ts    the queued-mission drain;
//   src/lib/composer/engine.ts composerTick   an active workflow advancing.
//
// Every other dispatch path begins with a click. The last describe block holds
// that boundary as source-level fact rather than as an intention: the attended
// modules must not so much as import the gate, because a gate they cannot reach
// is a gate that cannot be made to bite them by a later edit.

import { readFileSync } from "fs";
import { join } from "path";

const checkUnattendedSpend = jest.fn();
jest.mock("@/lib/spend/spend-guard", () => ({
  checkUnattendedSpend: () => checkUnattendedSpend(),
}));

// ── scheduler tick collaborators ──────────────────────────────
const getDueSchedules = jest.fn();
const advanceSchedule = jest.fn();
const createRun = jest.fn();
const hasDispatchedMission = jest.fn();
const dispatchMissionRun = jest.fn();
const getNextQueuedMission = jest.fn();
const dispatchMissionNow = jest.fn();
const listActiveComposerRuns = jest.fn();
const isFeatureEnabled = jest.fn();

jest.mock("@/lib/schedules-repository", () => ({
  getDueSchedules: (...a: unknown[]) => getDueSchedules(...a),
  advanceSchedule: (...a: unknown[]) => advanceSchedule(...a),
}));
jest.mock("@/lib/runs-repository", () => ({ createRun: (...a: unknown[]) => createRun(...a) }));
jest.mock("@/lib/missions/mission-repository", () => ({
  hasDispatchedMission: (...a: unknown[]) => hasDispatchedMission(...a),
  getNextQueuedMission: (...a: unknown[]) => getNextQueuedMission(...a),
}));
jest.mock("@/lib/orchestration/dispatch", () => ({
  dispatchMissionRun: (...a: unknown[]) => dispatchMissionRun(...a),
}));
jest.mock("@/lib/missions/mission-dispatch", () => ({
  dispatchMissionNow: (...a: unknown[]) => dispatchMissionNow(...a),
}));
jest.mock("@/lib/api-logger", () => ({ logApiError: jest.fn() }));

// ── composer tick collaborators ───────────────────────────────
jest.mock("@/lib/feature-flags", () => ({ isFeatureEnabled: (...a: unknown[]) => isFeatureEnabled(...a) }));
jest.mock("@/lib/composer/composer-repository", () => ({
  listActiveComposerRuns: (...a: unknown[]) => listActiveComposerRuns(...a),
  getComposerRun: jest.fn(),
  getComposerRunByParentNodeRunId: jest.fn(),
  getNode: jest.fn(),
  getNodeRun: jest.fn(),
  getNodeRunByRunId: jest.fn(),
  getOutgoingEdges: jest.fn(),
  getStartNode: jest.fn(),
  listComposerApprovals: jest.fn(),
  listNodeRuns: jest.fn(),
  maxAttemptForNode: jest.fn(),
  updateComposerRun: jest.fn(),
  updateNodeRun: jest.fn(),
}));
jest.mock("@/lib/composer/dispatch", () => ({ dispatchComposerNode: jest.fn() }));
jest.mock("@/lib/artifacts-repository", () => ({ captureArtifactOnce: jest.fn() }));
jest.mock("@/lib/laboratory/deep-research/research-repository", () => ({
  getResearchRunByComposerNodeRunId: jest.fn(),
}));

import { runSchedulerTick } from "@/lib/orchestration/scheduler/tick";
import { runMissionQueueTick } from "@/lib/missions/mission-queue-tick";
import { composerTick } from "@/lib/composer/engine";

const BLOCKED = {
  allowed: false,
  reason: "Hard spend stop: $18.00 of the $10.00 month budget is already spent.",
};
const ALLOWED = { allowed: true, reason: null };

beforeEach(() => {
  jest.clearAllMocks();
  checkUnattendedSpend.mockReturnValue(ALLOWED);
  hasDispatchedMission.mockReturnValue(false);
  createRun.mockReturnValue(true);
  dispatchMissionRun.mockResolvedValue({ ok: true, backendRunId: "b1", runId: "r1" });
  dispatchMissionNow.mockResolvedValue({ ok: true });
  getDueSchedules.mockReturnValue([]);
  getNextQueuedMission.mockReturnValue(null);
  listActiveComposerRuns.mockReturnValue([]);
  isFeatureEnabled.mockReturnValue(true);
});

describe("clause 4: the schedule tick stops when the armed figure is breached", () => {
  it("dispatches nothing, does not even look at what is due, and says why", async () => {
    checkUnattendedSpend.mockReturnValue(BLOCKED);

    const res = await runSchedulerTick({ now: new Date("2026-08-23T10:00:00.000Z") });

    expect(res.fired).toBe(0);
    expect(res.blocked).toBe(BLOCKED.reason);
    expect(getDueSchedules).not.toHaveBeenCalled();
    expect(dispatchMissionRun).not.toHaveBeenCalled();
    // A blocked tick must not consume the occurrence. Leaving next_run_at alone
    // is what makes the stop a pause rather than a silent cancellation: the
    // schedule fires on the first tick after the budget rolls over or the
    // operator raises it.
    expect(advanceSchedule).not.toHaveBeenCalled();
  });

  it("runs normally when the gate allows it", async () => {
    await runSchedulerTick({ now: new Date("2026-08-23T10:00:00.000Z") });
    expect(getDueSchedules).toHaveBeenCalled();
  });

  it("does not consult the gate at all when this process is not the scheduler owner", async () => {
    await runSchedulerTick({ isOwner: false });
    expect(checkUnattendedSpend).not.toHaveBeenCalled();
  });
});

describe("clause 4: the queued-mission drain stops when the armed figure is breached", () => {
  it("dispatches nothing and says why", async () => {
    checkUnattendedSpend.mockReturnValue(BLOCKED);
    getNextQueuedMission.mockReturnValue({ id: "m1" });

    const res = await runMissionQueueTick();

    expect(res.ran).toBe(false);
    expect(res.blocked).toBe(BLOCKED.reason);
    expect(dispatchMissionNow).not.toHaveBeenCalled();
    // The mission stays queued. Nothing is failed, cancelled or dropped.
    expect(getNextQueuedMission).not.toHaveBeenCalled();
  });

  it("drains normally when the gate allows it", async () => {
    getNextQueuedMission.mockReturnValue({ id: "m1" });
    const res = await runMissionQueueTick();
    expect(res.ran).toBe(true);
    expect(dispatchMissionNow).toHaveBeenCalledWith("m1");
  });
});

describe("clause 4: the Composer tick stops when the armed figure is breached", () => {
  it("advances nothing and says why", async () => {
    checkUnattendedSpend.mockReturnValue(BLOCKED);
    listActiveComposerRuns.mockReturnValue([{ id: "cr1", status: "running" }]);

    const res = await composerTick({});

    expect(res.advanced).toBe(0);
    expect(res.blocked).toBe(BLOCKED.reason);
    expect(listActiveComposerRuns).not.toHaveBeenCalled();
  });

  it("does not consult the gate when Composer is switched off anyway", async () => {
    isFeatureEnabled.mockReturnValue(false);
    await composerTick({});
    expect(checkUnattendedSpend).not.toHaveBeenCalled();
  });
});

// ── Clause 5, held as source-level fact ───────────────────────
describe("clause 5: attended dispatch cannot reach the gate", () => {
  const ATTENDED = [
    // A human clicking Dispatch on a mission, and the shim every attended
    // caller routes through.
    "src/lib/orchestration/dispatch.ts",
    "src/lib/missions/mission-dispatch.ts",
    // The routes behind the buttons: dispatch, run-now, run-this-schedule-now,
    // approve-this-Composer-gate, start-a-Deep-Research-run.
    "src/app/api/missions/[id]/dispatch/route.ts",
    "src/app/api/missions/[id]/run/route.ts",
    "src/app/api/schedules/[id]/run/route.ts",
    "src/app/api/composer/runs/[id]/nodes/[nodeId]/approve/route.ts",
    "src/app/api/laboratory/research/route.ts",
  ];

  it.each(ATTENDED)("%s does not import the unattended spend gate", (file) => {
    const src = readFileSync(join(process.cwd(), file), "utf-8");
    expect(src).not.toContain("spend-guard");
    expect(src).not.toContain("checkUnattendedSpend");
  });
});
