/** @jest-environment node */

import { openBaselineDb } from "../helpers/baseline-db";
import { applyMissionQueueMigration } from "@/lib/db/apply-mission-queue-migration";
import type { RunSubmit, RunHandle } from "@/lib/runtime/types";

let database: import("better-sqlite3").Database | null = null;
const submit = jest.fn<Promise<RunHandle>, [RunSubmit]>();

// Jest hoists mock factories
jest.mock("@/lib/db", () => require("../helpers/baseline-db").dbSingletonMock(() => database));
jest.mock("@/lib/runtime", () => ({ runtime: {
  submitRun: (input: RunSubmit) => submit(input),
  stopRun: jest.fn(() => Promise.resolve()),
} }));
jest.mock("@/lib/spend/spend-guard", () => ({ checkUnattendedSpend: () => ({ allowed: true }) }));
jest.mock("@/lib/analytics/record-event", () => ({ recordEvent: jest.fn() }));
jest.mock("@/lib/api/api-logger", () => ({ logApiError: jest.fn() }));

import { createMission, getMission, updateMission } from "@/lib/missions/mission-repository";
import { runMissionQueueTick } from "@/lib/missions/mission-queue-tick";
import { createRun, getRun } from "@/lib/runs/runs-repository";
import { reconcileActiveRuns, reconcileRunsOnBoot } from "@/lib/orchestration/run-reconcile";
import { UNCONFIRMED_SUBMISSION_RESULT } from "@/lib/missions/mission-claim-state";

beforeEach(() => {
  database = openBaselineDb([applyMissionQueueMigration]);
  jest.clearAllMocks();
});

afterEach(() => {
  database?.close();
  database = null;
});

function queueMission() {
  const mission = createMission({ name: "Uncertain send", prompt: "work" });
  updateMission(mission.id, { queuedForRun: true });
  return mission.id;
}

it("holds a network-ambiguous mission submission without a new key or automatic replay", async () => {
  const missionId = queueMission();
  submit.mockRejectedValue(new TypeError("connection dropped after request was sent"));

  await runMissionQueueTick();
  const key = submit.mock.calls[0]?.[0].idempotencyKey;
  expect(key).toBeTruthy();
  expect(getMission(missionId)).toMatchObject({
    status: "dispatched", queuedForRun: false, result: UNCONFIRMED_SUBMISSION_RESULT,
  });
  expect(getRun(key!)).toMatchObject({
    id: key, missionId, status: "started", runId: null, error: null,
  });

  expect(reconcileRunsOnBoot()).toEqual({ failed: 0 });
  expect(await reconcileActiveRuns()).toBe(0);
  await runMissionQueueTick();
  expect(submit).toHaveBeenCalledTimes(1);
  expect(database!.prepare("SELECT id FROM runs WHERE mission_id = ?").all(missionId)).toEqual([{ id: key }]);
  expect(getMission(missionId)?.result).toBe(UNCONFIRMED_SUBMISSION_RESULT);
});

it("still fails a local pre-submit write error without telling the gateway to run", async () => {
  const missionId = queueMission();
  database!.exec(`CREATE TRIGGER reject_session BEFORE INSERT ON sessions
    BEGIN SELECT RAISE(ABORT, 'local session write refused'); END`);

  const result = await runMissionQueueTick();

  expect(result).toMatchObject({ ran: true, ok: false, missionId });
  expect(submit).not.toHaveBeenCalled();
  expect(getMission(missionId)).toMatchObject({
    status: "failed", result: expect.stringMatching(/local session write refused$/),
  });
  expect(database!.prepare("SELECT status, error FROM runs WHERE mission_id = ?").get(missionId)).toMatchObject({
    status: "failed", error: expect.stringMatching(/local session write refused$/),
  });
});

it("a chat run without a mission or backend ID reaches a terminal state on recovery", async () => {
  expect(createRun({ id: "chat-no-backend" })).toBe(true);

  reconcileRunsOnBoot();
  await reconcileActiveRuns();

  expect(getRun("chat-no-backend")).toMatchObject({ status: "failed" });
  expect(submit).not.toHaveBeenCalled();
});
