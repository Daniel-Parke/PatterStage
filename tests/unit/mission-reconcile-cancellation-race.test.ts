/** @jest-environment node */

import { execBaselineSchema, migrationsDir, openBaselineDb } from "../helpers/baseline-db";
import { applyMissionQueueMigration } from "@/lib/db/apply-mission-queue-migration";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";

let database: import("better-sqlite3").Database | null = null;
let secondConnection: import("better-sqlite3").Database | null = null;
let fixtureDirectory: string | null = null;
const getBackendRun = jest.fn<Promise<unknown>, [string, string?]>();
const stopBackendRun = jest.fn<Promise<void>, [string, string?]>();
const emit = jest.fn<void, [string, Record<string, unknown>]>();

// eslint-disable-next-line @typescript-eslint/no-require-imports -- Jest hoists mock factories
jest.mock("@/lib/db", () => require("../helpers/baseline-db").dbSingletonMock(() => database));
jest.mock("@/lib/runtime", () => ({ runtime: {
  getRun: (id: string, profile?: string) => getBackendRun(id, profile),
  stopRun: (id: string, profile?: string) => stopBackendRun(id, profile),
} }));
jest.mock("@/lib/analytics/record-event", () => ({
  recordEvent: (name: string, fields: Record<string, unknown>) => emit(name, fields),
}));
jest.mock("@/lib/runs/artifacts-repository", () => ({ captureArtifactOnce: jest.fn() }));
jest.mock("@/lib/api/api-logger", () => ({ logApiError: jest.fn() }));

import { createMission, getMission, reserveMissionRun } from "@/lib/missions/mission-repository";
import { acknowledgeMissionSubmission, getRun } from "@/lib/runs/runs-repository";
import { createSession } from "@/lib/sessions/session-repository";
import { finaliseCancelledMission } from "@/lib/missions/cancel-finalise";
import { reconcileActiveRuns, resetNotFoundTracker, RUN_NOT_FOUND_GRACE_MS } from "@/lib/orchestration/run-reconcile";
import { GRACE_MINUTES } from "@/lib/orchestration/run-deadline";
import { RuntimeRequestError } from "@/lib/runtime/types";

function heldReply() {
  let resolve!: (value: { status: "completed" | "started"; output: string }) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<{ status: "completed" | "started"; output: string }>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function openSharedFile(): void {
  fixtureDirectory = mkdtempSync(join(tmpdir(), "t0183-reconcile-"));
  const path = join(fixtureDirectory, "claims.sqlite");
  const Sqlite = jest.requireActual(
    join(process.cwd(), "node_modules", "better-sqlite3", "lib", "index.js"),
  ) as new (filename: string) => import("better-sqlite3").Database;
  database?.close();
  database = new Sqlite(path);
  database.pragma("foreign_keys = ON");
  execBaselineSchema(database);
  applyMissionQueueMigration(database, migrationsDir);
  secondConnection = new Sqlite(path);
  secondConnection.pragma("foreign_keys = ON");
  secondConnection.pragma("busy_timeout = 25");
}

beforeEach(() => {
  database = openBaselineDb([applyMissionQueueMigration]);
  jest.clearAllMocks();
  stopBackendRun.mockResolvedValue();
  jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate"] });
  jest.setSystemTime(Date.parse("2026-09-28T12:00:00.000Z"));
  resetNotFoundTracker();
});

afterEach(() => {
  jest.useRealTimers();
  secondConnection?.close();
  secondConnection = null;
  database?.close();
  database = null;
  if (fixtureDirectory) {
    const resolved = realpathSync(fixtureDirectory);
    if (dirname(resolved) !== realpathSync(tmpdir()) || !basename(resolved).startsWith("t0183-reconcile-")) {
      throw new Error("Refusing to remove a directory outside the isolated test fixture");
    }
    rmSync(resolved, { recursive: true, force: true });
    fixtureDirectory = null;
  }
});

type Verdict = "completed" | "timeout" | "persistent 404" | "unreachable deadline";

it.each<Verdict>(["completed", "timeout", "persistent 404", "unreachable deadline"])(
  "a cancellation committed during getRun stays terminal after %s",
  async (verdict) => {
    if (verdict === "completed") openSharedFile();
    const mission = createMission({
      name: `Reconcile ${verdict}`,
      prompt: "held gateway reply",
      timeoutMinutes: verdict === "timeout" ? 1 : undefined,
    });
    const claim = reserveMissionRun({ kind: "attended", missionId: mission.id });
    expect(claim.kind).toBe("claimed");
    if (claim.kind !== "claimed") return;
    const session = createSession({ source: "mission", missionId: mission.id });
    expect(acknowledgeMissionSubmission(claim.runId, mission.id, {
      runId: "backend-held", sessionId: session.id, status: "started",
    })).toBe(true);

    if (verdict === "persistent 404") {
      getBackendRun.mockRejectedValueOnce(new RuntimeRequestError("missing", 404));
      expect(await reconcileActiveRuns()).toBe(0);
      jest.setSystemTime(Date.now() + RUN_NOT_FOUND_GRACE_MS + 1);
    } else if (verdict === "timeout") {
      jest.setSystemTime(Date.now() + (1 + GRACE_MINUTES + 1) * 60_000);
    } else if (verdict === "unreachable deadline") {
      jest.setSystemTime(Date.now() + 200 * 60_000);
    }

    const reply = heldReply();
    getBackendRun.mockImplementationOnce(() => reply.promise);
    const polling = reconcileActiveRuns();
    expect(getBackendRun).toHaveBeenCalledTimes(verdict === "persistent 404" ? 2 : 1);

    // The second SQLite handle commits cancellation while the first owns the
    // held poll. The reconciler must observe that committed state before write.
    const firstConnection = database;
    if (secondConnection) database = secondConnection;
    expect(finaliseCancelledMission(mission.id, false)).toMatchObject({
      status: "failed", result: "Cancelled by user",
    });
    database = firstConnection;

    if (verdict === "completed") reply.resolve({ status: "completed", output: "late success" });
    else if (verdict === "timeout") reply.resolve({ status: "started", output: "" });
    else reply.reject(verdict === "persistent 404"
      ? new RuntimeRequestError("missing", 404)
      : new TypeError("gateway unreachable"));
    await polling;

    expect(getMission(mission.id)).toMatchObject({ status: "failed", result: "Cancelled by user" });
    expect(getRun(claim.runId)).toMatchObject({ status: "cancelled", error: "Cancelled by user" });
    expect(database!.prepare("SELECT status, error FROM sessions WHERE id = ?").get(session.id)).toMatchObject({
      status: "failed", error: "Cancelled by user",
    });
    expect(emit).not.toHaveBeenCalledWith("mission.completed", expect.anything());
    expect(emit).not.toHaveBeenCalledWith("mission.failed", expect.anything());
  },
);

it("a second SQLite connection can cancel between a fresh-state read and terminal write", async () => {
  openSharedFile();
  const mission = createMission({ name: "Cross-connection cancellation", prompt: "work" });
  const claim = reserveMissionRun({ kind: "attended", missionId: mission.id });
  expect(claim.kind).toBe("claimed");
  if (claim.kind !== "claimed") return;
  const session = createSession({ source: "mission", missionId: mission.id });
  expect(acknowledgeMissionSubmission(claim.runId, mission.id, {
    runId: "backend-cross-connection", sessionId: session.id, status: "started",
  })).toBe(true);

  const held = heldReply();
  getBackendRun.mockImplementationOnce(() => held.promise);
  const polling = reconcileActiveRuns();
  const firstConnection = database!;
  let cancellationInjected = false;
  const competingCancel: { outcome: "committed" | "busy" | null } = { outcome: null };
  const interceptedDb: import("better-sqlite3").Database = new Proxy(firstConnection, {
    get(target, property) {
      if (property !== "prepare") {
        const value = Reflect.get(target, property, target) as unknown;
        return typeof value === "function" ? value.bind(target) : value;
      }
      return (sql: string) => {
        const statement = target.prepare(sql);
        if (sql !== "SELECT * FROM runs WHERE id = ?" || cancellationInjected) return statement;
        return new Proxy(statement, {
          get(prepared, method) {
            if (method !== "get") return Reflect.get(prepared, method, prepared);
            return (...args: unknown[]) => {
              const fresh = prepared.get(...args);
              cancellationInjected = true;
              database = secondConnection;
              try {
                expect(finaliseCancelledMission(mission.id, false)).toMatchObject({
                  status: "failed", result: "Cancelled by user",
                });
                competingCancel.outcome = "committed";
              } catch (error) {
                if (error && typeof error === "object" && "code" in error && error.code === "SQLITE_BUSY") {
                  competingCancel.outcome = "busy";
                } else {
                  throw error;
                }
              } finally {
                database = interceptedDb;
              }
              return fresh;
            };
          },
        });
      };
    },
  });
  database = interceptedDb;
  try {
    held.resolve({ status: "completed", output: "obsolete success" });
    await polling;
  } finally {
    database = firstConnection;
  }

  expect(cancellationInjected).toBe(true);
  if (competingCancel.outcome === "committed") {
    // A committed cancellation must win. Never retry here: that would hide a
    // reconciler which overwrote the first accepted operator decision.
    expect(getMission(mission.id)).toMatchObject({ status: "failed", result: "Cancelled by user" });
    expect(getRun(claim.runId)).toMatchObject({ status: "cancelled", error: "Cancelled by user" });
    expect(database!.prepare("SELECT status, error FROM sessions WHERE id = ?").get(session.id)).toMatchObject({
      status: "failed", error: "Cancelled by user",
    });
    return;
  }

  expect(competingCancel.outcome).toBe("busy");
  // BEGIN IMMEDIATE serialises the writers. SQLITE_BUSY means cancellation did
  // not commit or become an accepted operator decision; no retry is implied.
  expect(getMission(mission.id)).toMatchObject({ status: "successful", result: "obsolete success" });
  expect(getRun(claim.runId)).toMatchObject({ status: "completed", output: "obsolete success" });
  expect(database!.prepare("SELECT status, error FROM sessions WHERE id = ?").get(session.id)).toMatchObject({
    status: "completed", error: null,
  });
});
