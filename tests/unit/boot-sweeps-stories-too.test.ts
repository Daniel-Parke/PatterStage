/** @jest-environment node */

// T-0087, the seam. A module's reconcileOnBoot exists; this pins that the
// process actually calls it at boot, beside the mission sweep it mirrors. A sweep
// nothing invokes is the T-0071 lesson again: correct, tested, unreachable.

jest.mock("@/lib/sync/SyncScheduler", () => ({
  SyncScheduler: class {
    register() {}
    start() {}
    stop() {}
  },
}));
jest.mock("@/lib/system-repository", () => ({ getSystemStat: jest.fn(), upsertMetaValue: jest.fn() }));
jest.mock("@/lib/orchestration/RunSync", () => ({ RunSync: class {} }));
jest.mock("@/lib/composer/seed", () => ({ ensureDefaultComposerWorkflows: jest.fn() }));
jest.mock("@/lib/composer/scheduler/composer-tick", () => ({ ComposerTickSource: class {} }));
jest.mock("@/lib/orchestration/scheduler/tick", () => ({ ScheduleTickSource: class {} }));

const mockRuns = jest.fn(() => ({ failed: 0 }));
jest.mock("@/lib/orchestration/run-reconcile", () => ({ reconcileRunsOnBoot: () => mockRuns() }));
const mockStories = jest.fn();
// Through the composition root, never a direct module import (ADR-0005).
jest.mock("@/lib/modules/server", () => ({
  SERVER_MODULES: [{ id: "rec-room", reconcileOnBoot: () => mockStories() }, { id: "hermes" }],
}));

import { ensureBackgroundScheduler } from "@/lib/orchestration/scheduler/BackgroundScheduler";

it("boot runs the story sweep beside the mission sweep", () => {
  ensureBackgroundScheduler();

  expect(mockRuns).toHaveBeenCalledTimes(1);
  expect(mockStories).toHaveBeenCalledTimes(1);
});

it("a throwing story sweep does not stop the scheduler from starting", () => {
  // Same posture as the mission sweep's try/catch: a sweep is best-effort at
  // boot, never a reason the process refuses to schedule.
  mockStories.mockImplementationOnce(() => { throw new Error("db locked"); });
  const spy = jest.spyOn(console, "warn").mockImplementation(() => {});

  // _ensured is module-level; a fresh module instance is needed for a second boot.
  jest.isolateModules(() => {
    const mod = jest.requireActual("@/lib/orchestration/scheduler/BackgroundScheduler") as typeof import("@/lib/orchestration/scheduler/BackgroundScheduler");
    expect(() => mod.ensureBackgroundScheduler()).not.toThrow();
  });
  spy.mockRestore();
});
