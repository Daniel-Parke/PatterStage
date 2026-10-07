/** @jest-environment node */

// T-0183 independent R2 oracle. The database is real SQLite; only the external
// runtime, spend decision and event sink are controlled. No gateway is opened.
import { execBaselineSchema, migrationsDir, openBaselineDb } from "../helpers/baseline-db";
import { applyMissionQueueMigration } from "@/lib/db/apply-mission-queue-migration";
import type { RunSubmit, RunHandle } from "@/lib/runtime/types";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";

let testDb: import("better-sqlite3").Database | null = null;
const submitRun = jest.fn<Promise<RunHandle>, [RunSubmit]>();
const stopRun = jest.fn<Promise<void>, [string, string?]>();
const recordEvent = jest.fn();

// Jest mock factory is hoisted
jest.mock("@/lib/db", () => require("../helpers/baseline-db").dbSingletonMock(() => testDb));
jest.mock("@/lib/runtime", () => ({
  runtime: {
    submitRun: (input: RunSubmit) => submitRun(input),
    stopRun: (id: string, profile?: string) => stopRun(id, profile),
  },
}));
jest.mock("@/lib/spend/spend-guard", () => ({
  checkUnattendedSpend: () => ({ allowed: true, reason: null }),
}));
jest.mock("@/lib/analytics/record-event", () => ({
  recordEvent: (...args: unknown[]) => recordEvent(...args),
}));
jest.mock("@/lib/api/api-logger", () => ({ logApiError: jest.fn() }));

import { createMission, getMission, updateMission } from "@/lib/missions/mission-repository";
import { runMissionQueueTick } from "@/lib/missions/mission-queue-tick";
import { handleCancelMission } from "@/lib/missions/mission-handlers/cancel";
import { createSchedule } from "@/lib/schedule/schedules-repository";
import { runSchedulerTick } from "@/lib/orchestration/scheduler/tick";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function queuedMission() {
  const mission = createMission({ name: "Held dispatch", prompt: "Do isolated work" });
  updateMission(mission.id, { queuedForRun: true });
  return mission.id;
}

function runsFor(missionId: string): Array<{
  id: string; run_id: string | null; status: string; session_id: string | null;
}> {
  return testDb!.prepare(
    "SELECT id, run_id, status, session_id FROM runs WHERE mission_id = ? ORDER BY submitted_at, id",
  ).all(missionId) as Array<{
    id: string; run_id: string | null; status: string; session_id: string | null;
  }>;
}

function sessionsFor(missionId: string): Array<{ id: string; status: string }> {
  return testDb!.prepare(
    "SELECT id, status FROM sessions WHERE mission_id = ?",
  ).all(missionId) as Array<{ id: string; status: string }>;
}

function openFileDb(path: string, initialise: boolean): import("better-sqlite3").Database {
  const Database = jest.requireActual(
    join(process.cwd(), "node_modules", "better-sqlite3", "lib", "index.js"),
  ) as unknown as new (filename: string) => import("better-sqlite3").Database;
  const database = new Database(path);
  database.pragma("foreign_keys = ON");
  if (initialise) {
    execBaselineSchema(database);
    applyMissionQueueMigration(database, migrationsDir);
  }
  return database;
}

async function nextTurn(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve));
}

beforeEach(() => {
  testDb = openBaselineDb([applyMissionQueueMigration]);
  jest.clearAllMocks();
  stopRun.mockResolvedValue();
});

afterEach(() => {
  testDb?.close();
  testDb = null;
});

describe("T-0183 unattended dispatch has one durable owner", () => {
  it.each([2, 3, 4])(
    "%i overlapping queue ticks submit one run with one idempotency key and session",
    async (tickCount) => {
      const missionId = queuedMission();
      const held = deferred<RunHandle>();
      const submitted = deferred<void>();
      submitRun.mockImplementation((input) => {
        if (input.idempotencyKey) submitted.resolve();
        return held.promise;
      });

      const first = runMissionQueueTick();
      await submitted.promise;
      const otherTicks = Array.from({ length: tickCount - 1 }, () => runMissionQueueTick());
      await nextTurn();
      held.resolve({ runId: "backend-queue", status: "started" });
      await Promise.all([first, ...otherTicks]);

      const runs = runsFor(missionId);
      expect(submitRun).toHaveBeenCalledTimes(1);
      expect(runs).toHaveLength(1);
      expect(submitRun.mock.calls.map(([input]) => input.idempotencyKey)).toEqual([runs[0]?.id]);
      expect(sessionsFor(missionId)).toHaveLength(1);
    },
  );

  it("a due cron tick cannot submit the mission while its queue claim is pending", async () => {
    const missionId = queuedMission();
    createSchedule({
      missionId,
      schedule: "every 30m",
      nextRunAt: "2026-09-28T09:00:00.000Z",
    });
    const held = deferred<RunHandle>();
    const submitted = deferred<void>();
    submitRun.mockImplementation(() => {
      submitted.resolve();
      return held.promise;
    });

    const queueTick = runMissionQueueTick();
    await submitted.promise;
    const cronTick = runSchedulerTick({ now: new Date("2026-09-28T10:00:00.000Z") });
    await nextTurn();
    held.resolve({ runId: "backend-shared", status: "started" });
    await Promise.all([queueTick, cronTick]);

    const runs = runsFor(missionId);
    expect(submitRun).toHaveBeenCalledTimes(1);
    expect(runs).toHaveLength(1);
    expect(submitRun.mock.calls.map(([input]) => input.idempotencyKey)).toEqual([runs[0]?.id]);
    expect(sessionsFor(missionId)).toHaveLength(1);
  });

  it("a fresh worker holds an unconfirmed submission for operator review without a new key", async () => {
    const directory = mkdtempSync(join(tmpdir(), "t0183-oracle-"));
    const databasePath = join(directory, "mission.sqlite");
    const held = deferred<RunHandle>();
    const submitted = deferred<void>();
    let first: Promise<unknown> | null = null;
    try {
      testDb!.close();
      testDb = openFileDb(databasePath, true);
      const missionId = queuedMission();
      submitRun.mockImplementationOnce(() => {
        submitted.resolve();
        return held.promise;
      }).mockResolvedValue({ runId: "backend-unwanted-replay", status: "started" });

      first = runMissionQueueTick();
      await submitted.promise;
      const claimedRunId = runsFor(missionId)[0]?.id;
      expect(claimedRunId).toBeTruthy();
      testDb!.close();
      testDb = openFileDb(databasePath, false);
      updateMission(missionId, { result: null });
      expect(getMission(missionId)?.result).toBeUndefined();

      // A new module instance has no in-process knowledge of the old worker.
      jest.resetModules();
      const { reconcileRunsOnBoot } = await import("@/lib/orchestration/run-reconcile");
      const { runMissionQueueTick: restartedTick } = await import("@/lib/missions/mission-queue-tick");
      expect(reconcileRunsOnBoot()).toEqual({ failed: 0 });
      await restartedTick();

      const mission = getMission(missionId);
      expect(submitRun).toHaveBeenCalledTimes(1);
      expect(runsFor(missionId).map((run) => run.id)).toEqual([claimedRunId]);
      expect(mission?.queuedForRun).toBe(false);
      expect(`${mission?.result ?? ""} ${mission?.error ?? ""}`).toMatch(/unconfirmed|uncertain|unknown/i);
    } finally {
      held.resolve({ runId: "backend-original", status: "started" });
      if (first) await Promise.allSettled([first]);
      testDb?.close();
      testDb = null;
      const resolved = realpathSync(directory);
      if (dirname(resolved) !== realpathSync(tmpdir()) || !basename(resolved).startsWith("t0183-oracle-")) {
        throw new Error("Refusing to remove a directory outside the isolated oracle fixture");
      }
      rmSync(resolved, { recursive: true, force: true });
    }
  });

  it("cancellation stays final when a held submission later succeeds", async () => {
    const missionId = queuedMission();
    const held = deferred<RunHandle>();
    const submitted = deferred<void>();
    submitRun.mockImplementation(() => {
      submitted.resolve();
      return held.promise;
    });

    const tick = runMissionQueueTick();
    await submitted.promise;
    expect(handleCancelMission({ id: missionId }).status).toBe(200);
    held.resolve({ runId: "backend-after-cancel", status: "started" });
    await tick;
    await nextTurn();

    expect(getMission(missionId)).toMatchObject({
      status: "failed", result: "Cancelled by user", queuedForRun: false,
    });
    expect(runsFor(missionId)).toEqual([
      expect.objectContaining({ status: "cancelled" }),
    ]);
    expect(recordEvent.mock.calls.filter(([type]) => type === "mission.dispatched")).toHaveLength(0);
    expect(stopRun.mock.calls.map(([id]) => id)).toContain("backend-after-cancel");
  });

  it("cancellation stays final when a held submission later rejects", async () => {
    const missionId = queuedMission();
    const held = deferred<RunHandle>();
    const submitted = deferred<void>();
    submitRun.mockImplementation(() => {
      submitted.resolve();
      return held.promise;
    });

    const tick = runMissionQueueTick();
    await submitted.promise;
    expect(handleCancelMission({ id: missionId }).status).toBe(200);
    held.reject(new Error("isolated runtime rejected submission"));
    await tick;

    expect(getMission(missionId)).toMatchObject({
      status: "failed", result: "Cancelled by user", queuedForRun: false,
    });
    expect(runsFor(missionId)).toEqual([
      expect.objectContaining({ status: "cancelled" }),
    ]);
    expect(recordEvent.mock.calls.filter(([type]) => type === "mission.dispatched")).toHaveLength(0);
  });
});
