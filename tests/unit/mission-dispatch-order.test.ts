/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * @jest-environment node
 *
 * Bug regression test: dispatchMissionNow previously called
 * `updateMission({ status: "dispatched" })` BEFORE the
 * `agentBackend.dispatchMission` call that writes the on-disk
 * artifacts. Consequence: if the next-server itself crashed
 * (OOM, host restart, segfault) between the two calls, the
 * mission row was stuck as "dispatched" with no on-disk
 * artifacts and no process running — exactly the orphan
 * scenario the dashboard "active but no session" symptom
 * describes.
 *
 * Fix: the dispatch path now writes the on-disk artifacts
 * (via `agentBackend.dispatchMission`) BEFORE the DB row is
 * updated to "dispatched", and the bash script is spawned
 * (via `agentBackend.spawnDispatchedMission`) AFTER the DB
 * transition.
 *
 * This test uses a single shared `callOrder` array that is
 * pushed from BOTH the agentBackend mock and the
 * mission-repository mock, so the order can be asserted
 * across the boundary.
 */
import { mkdtempSync, rmSync, existsSync, mkdirSync, writeFileSync, chmodSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

let tmpRoot: string;
let missionsDir: string;
let fakeHermesRoot: string;
const callOrder: string[] = [];

beforeAll(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), "ch-dispatch-order-"));
  missionsDir = join(tmpRoot, "missions");
  fakeHermesRoot = join(tmpRoot, "fake-hermes");
  mkdirSync(missionsDir, { recursive: true });
  mkdirSync(fakeHermesRoot, { recursive: true });
  const fakeHermes = join(fakeHermesRoot, "hermes");
  writeFileSync(fakeHermes, "#!/bin/bash\nexit 0\n");
  chmodSync(fakeHermes, 0o755);
  const prevPath = process.env.PATH;
  process.env.PATH = `${fakeHermesRoot}${require("path").delimiter}${prevPath ?? ""}`;
});

afterAll(() => {
  if (tmpRoot && existsSync(tmpRoot)) rmSync(tmpRoot, { recursive: true, force: true });
});

beforeEach(() => {
  if (existsSync(missionsDir)) {
    rmSync(missionsDir, { recursive: true, force: true });
  }
  mkdirSync(missionsDir, { recursive: true });
  callOrder.length = 0;

  jest.resetModules();
  jest.doMock("@/lib/paths", () => {
    const actual = jest.requireActual("@/lib/paths") as Record<string, unknown>;
    return { ...actual, PATHS: { ...(actual.PATHS as object), missions: missionsDir } };
  });
  jest.doMock("@/lib/db", () => {
    const actual = jest.requireActual("@/lib/db") as Record<string, unknown>;
    return {
      ...actual,
      db: () => ({
        prepare: () => ({
          run: () => ({}),
          get: () => undefined,
          all: () => [],
        }),
        transaction: (fn: () => unknown) => fn(),
      }),
      inTransaction: (fn: () => unknown) => fn(),
    };
  });
  jest.doMock("@/lib/session-repository", () => ({
    createSession: () => ({ id: "s-mock" }),
    updateSession: () => {
      /* noop */
    },
  }));
  // The shared callOrder is referenced by closure from the
  // module-mocked functions below. Because mocks are evaluated
  // at require() time, we put the same shared array reference
  // into both the mission-repository and agentBackend mocks.
  jest.doMock("@/lib/mission-repository", () => {
    const actual = jest.requireActual("@/lib/mission-repository") as Record<string, unknown>;
    return {
      ...actual,
      getMission: (id: string) => ({
        id,
        name: "Test",
        prompt: "<hermes_mission></hermes_mission>",
        status: "queued",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
      updateMission: (id: string, updates: { status?: string }) => {
        callOrder.push(`mission:update:${updates.status}`);
        return { id, ...updates };
      },
    };
  });
  jest.doMock("@/lib/backends", () => {
    const actual = jest.requireActual("@/lib/backends") as Record<string, unknown>;
    return {
      ...actual,
      agentBackend: {
        async dispatchMission(input: { missionId: string; name: string; prompt: string }) {
          callOrder.push("backend:dispatch-start");
          const missionFile = join(missionsDir, `${input.missionId}.json`);
          writeFileSync(
            missionFile,
            JSON.stringify({
              id: input.missionId,
              name: input.name,
              prompt: input.prompt,
              status: "dispatched",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }, null, 2),
          );
          callOrder.push("backend:dispatch-disk-written");
          return { id: input.missionId, name: input.name, status: "dispatched" };
        },
        async spawnDispatchedMission() {
          callOrder.push("backend:spawn");
        },
        async cancelMission() {
          return { processKilled: false, error: null };
        },
        async getMissionStatus() {
          return "dispatched" as const;
        },
        async getMissionSessionId() {
          return null;
        },
        async syncMission() {
          /* noop */
        },
      },
    };
  });
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.resetModules();
  jest.dontMock("@/lib/paths");
  jest.dontMock("@/lib/db");
  jest.dontMock("@/lib/session-repository");
  jest.dontMock("@/lib/mission-repository");
  jest.dontMock("@/lib/backends");
});

describe("dispatchMissionNow — disk-then-DB-then-spawn ordering", () => {
  it("writes the on-disk mission.json before updating the DB row to dispatched", async () => {
    const { dispatchMissionNow } = require("@/lib/mission-dispatch") as {
      dispatchMissionNow: (id: string) => Promise<{ ok: boolean }>;
    };
    const result = await dispatchMissionNow("m-order-test");
    expect(result.ok).toBe(true);

    const diskWriteIdx = callOrder.indexOf("backend:dispatch-disk-written");
    const dbUpdateIdx = callOrder.indexOf("mission:update:dispatched");
    const spawnIdx = callOrder.indexOf("backend:spawn");

    // All three markers must be present
    expect(diskWriteIdx).toBeGreaterThanOrEqual(0);
    expect(dbUpdateIdx).toBeGreaterThanOrEqual(0);
    expect(spawnIdx).toBeGreaterThanOrEqual(0);
    // Order: disk write -> DB update -> spawn
    expect(diskWriteIdx).toBeLessThan(dbUpdateIdx);
    expect(dbUpdateIdx).toBeLessThan(spawnIdx);
    // The on-disk mission.json exists after dispatch
    expect(existsSync(join(missionsDir, "m-order-test.json"))).toBe(true);
  });

  it("the on-disk mission.json is present whenever the DB row reaches 'dispatched'", async () => {
    // We use the same callOrder-shared mocks. The mission
    // file is written as part of backend:dispatch, which
    // runs BEFORE the DB update. So by the time the DB sees
    // mission:update:dispatched, the file MUST exist.
    const { dispatchMissionNow } = require("@/lib/mission-dispatch") as {
      dispatchMissionNow: (id: string) => Promise<{ ok: boolean }>;
    };
    await dispatchMissionNow("m-disk-when-db-updated");

    const dbUpdateIdx = callOrder.indexOf("mission:update:dispatched");
    // Up to and including the DB dispatch update, only the
    // dispatch+disk-write events should have happened. No
    // spawn yet.
    const eventsBeforeDbUpdate = callOrder.slice(0, dbUpdateIdx + 1);
    // The disk write marker is present
    expect(eventsBeforeDbUpdate).toContain("backend:dispatch-disk-written");
    // The spawn marker is NOT present yet (proves spawn is
    // after the DB transition)
    expect(eventsBeforeDbUpdate).not.toContain("backend:spawn");
    // The mission file is on disk
    expect(existsSync(join(missionsDir, "m-disk-when-db-updated.json"))).toBe(true);
  });
});
