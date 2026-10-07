/** @jest-environment node */

// T-0183: independent edge contracts over persisted mission and run rows.
import { openBaselineDb } from "../helpers/baseline-db";
import { applyMissionQueueMigration } from "@/lib/db/apply-mission-queue-migration";
import type { RunHandle, RunResult, RunSubmit } from "@/lib/runtime/types";

let database: import("better-sqlite3").Database | null = null;
const gateway = {
  submit: jest.fn<Promise<RunHandle>, [RunSubmit]>(),
  poll: jest.fn<Promise<RunResult>, [string]>(),
  stop: jest.fn<Promise<void>, [string]>(),
};
const errors = jest.fn();

// Jest hoists its mock factories
jest.mock("@/lib/db", () => require("../helpers/baseline-db").dbSingletonMock(() => database));
jest.mock("@/lib/runtime", () => ({ runtime: {
  submitRun: (request: RunSubmit) => gateway.submit(request),
  getRun: (id: string) => gateway.poll(id),
  stopRun: (id: string) => gateway.stop(id),
} }));
jest.mock("@/lib/spend/spend-guard", () => ({ checkUnattendedSpend: () => ({ allowed: true }) }));
jest.mock("@/lib/api/api-logger", () => ({ logApiError: (...args: unknown[]) => errors(...args) }));
jest.mock("@/lib/api/audit-log", () => ({ appendAuditLine: jest.fn() }));
jest.mock("@/lib/analytics/record-event", () => ({ recordEvent: jest.fn() }));
jest.mock("@/lib/missions/mission-queue-tick", () => {
  const actual = jest.requireActual("@/lib/missions/mission-queue-tick");
  return { ...actual, runMissionQueueTick: jest.fn(actual.runMissionQueueTick) };
});

import { createMission, getMission, updateMission } from "@/lib/missions/mission-repository";
import { runMissionQueueTick } from "@/lib/missions/mission-queue-tick";
import * as queueTickModule from "@/lib/missions/mission-queue-tick";
import { createRun, attachBackendRun } from "@/lib/runs/runs-repository";
import { handleCancelMission } from "@/lib/missions/mission-handlers/cancel";
import { handleDispatchMission } from "@/lib/missions/mission-handlers/dispatch";
import { reconcileActiveRuns, reconcileRunsOnBoot } from "@/lib/orchestration/run-reconcile";
import { describeMissionRunState } from "@/lib/missions/mission-run-state";

function gate<T>() {
  let release!: (value: T) => void;
  let fail!: (reason: Error) => void;
  const pending = new Promise<T>((resolve, reject) => { release = resolve; fail = reject; });
  return { pending, release, fail };
}

function dueMission(): string {
  const mission = createMission({ name: "Edge contract", prompt: "Isolated task" });
  updateMission(mission.id, { queuedForRun: true });
  return mission.id;
}

const runRows = (missionId: string) => database!.prepare(
  "SELECT id, run_id, status FROM runs WHERE mission_id = ? ORDER BY rowid",
).all(missionId) as Array<{ id: string; run_id: string | null; status: string }>;

beforeEach(() => {
  database = openBaselineDb([applyMissionQueueMigration]);
  jest.clearAllMocks();
  gateway.stop.mockResolvedValue();
});

afterEach(() => { database?.close(); database = null; });

it("cancels every active run and stops both known backend IDs after an older poll completes", async () => {
  const missionId = dueMission();
  updateMission(missionId, { status: "dispatched", queuedForRun: false });
  for (const [local, remote] of [["older-claim", "backend-older"], ["newer-claim", "backend-newer"]]) {
    expect(createRun({ id: local!, missionId })).toBe(true);
    attachBackendRun(local!, { runId: remote!, status: "started" });
  }
  const oldPoll = gate<RunResult>();
  const polling = gate<void>();
  gateway.poll.mockImplementation(async (id) => {
    if (id === "backend-older") { polling.release(); return oldPoll.pending; }
    return { runId: id, status: "started" };
  });

  const reconciliation = reconcileActiveRuns();
  await polling.pending;
  expect(handleCancelMission({ id: missionId }).status).toBe(200);
  oldPoll.release({ runId: "backend-older", status: "completed", output: "stale answer" });
  await reconciliation;
  await new Promise<void>((resolve) => setImmediate(resolve));

  expect(getMission(missionId)).toMatchObject({ status: "failed", result: "Cancelled by user" });
  expect(runRows(missionId).map(({ status }) => status)).toEqual(["cancelled", "cancelled"]);
  expect(gateway.stop.mock.calls.map(([id]) => id).sort()).toEqual(["backend-newer", "backend-older"]);
  expect(gateway.submit).not.toHaveBeenCalled();
});

it("finishes an immediate terminal acknowledgement through an authoritative output poll", async () => {
  const missionId = dueMission();
  gateway.submit.mockResolvedValue({ runId: "backend-immediate", status: "completed" });
  gateway.poll.mockResolvedValue({ runId: "backend-immediate", status: "completed", output: "final answer" });

  expect(await runMissionQueueTick()).toMatchObject({ ran: true, ok: true });
  await reconcileActiveRuns();

  expect(gateway.poll).toHaveBeenCalledWith("backend-immediate");
  expect(getMission(missionId)).toMatchObject({ status: "successful", result: "final answer" });
  expect(runRows(missionId)).toEqual([expect.objectContaining({ status: "completed" })]);
});

it("shows an active held submission as running, then an ambiguous outcome as reviewable", async () => {
  const missionId = dueMission();
  const submission = gate<RunHandle>();
  const entered = gate<void>();
  gateway.submit.mockImplementation(() => { entered.release(); return submission.pending; });
  const dispatch = runMissionQueueTick();
  await entered.pending;

  const active = getMission(missionId)!;
  const activeView = describeMissionRunState(active, Date.now());
  submission.fail(new Error("reply lost after request"));
  await dispatch;
  reconcileRunsOnBoot();
  const uncertain = describeMissionRunState(getMission(missionId)!, Date.now());
  expect(activeView.label).toBe("Running");
  expect(activeView.note ?? "").not.toMatch(/unconfirmed|uncertain|unknown/i);
  expect(uncertain.label).toBe("Waiting for you");
  expect(uncertain.note).toMatch(/unconfirmed|uncertain|unknown/i);
});

it("keeps a failed reservation visible to sync and handles the detached dispatch rejection", async () => {
  const missionId = dueMission();
  const locked = Object.assign(new Error("database is locked"), { code: "SQLITE_BUSY" });
  const transactionSpy = jest.spyOn(database!, "transaction").mockImplementationOnce(() => {
    throw locked;
  });
  let escaped: unknown = null;
  try {
    try {
      await runMissionQueueTick();
    } catch (error) {
      escaped = error;
    }
  } finally {
    transactionSpy.mockRestore();
  }
  expect(escaped).toBe(locked);
  expect(getMission(missionId)).toMatchObject({ status: "queued", queuedForRun: true });
  expect(runRows(missionId)).toHaveLength(0);
  expect(gateway.submit).not.toHaveBeenCalled();

  let rejectionHandled = false;
  const controlled = {
    catch(onRejected: (reason: Error) => unknown) {
      rejectionHandled = true;
      onRejected(locked);
      return Promise.resolve({ ran: false });
    },
  } as unknown as ReturnType<typeof runMissionQueueTick>;
  const detachedTick = jest.mocked(queueTickModule.runMissionQueueTick);
  detachedTick.mockClear();
  detachedTick.mockImplementationOnce(() => controlled);
  const response = await handleDispatchMission({ instruction: "Queue an isolated mission", dispatchMode: "queue" });
  expect(response.status).toBe(201);
  expect(detachedTick).toHaveBeenCalledTimes(1);
  expect(rejectionHandled).toBe(true);
  expect(errors.mock.calls.some((call) => call.includes(locked))).toBe(true);
});
