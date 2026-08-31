/** @jest-environment node */

// T-0078 acceptance oracle — a backend that has forgotten a run gets a moment
// to remember before the run is declared dead.
//
// THE DEFECT, and it hid behind a flaky-looking harness. reconcile treats a 404
// from the gateway as authoritative and terminal on the FIRST observation, with
// no grace and no confirming poll:
//
//   run-reconcile.ts  mission branch   404 -> failed, immediately
//   run-reconcile.ts  composer twin    404 -> stage failed, immediately
//
// Hermes keeps its run registry in memory. So a Hermes restart — an upgrade, a
// crash, an operator bouncing the service — answers 404 for every live run, and
// PatterStage fails EVERY in-flight mission and EVERY in-flight Composer stage
// on the next tick. The scheduler runs a cycle immediately on boot and every 15
// seconds after, so the window is seconds, not minutes.
//
// This was found because restart-recovery.mjs failed 2/17 on a reviewer's
// machine and passed on ours. The difference was whether anything was listening
// on the gateway port: with nothing there, ECONNREFUSED takes the
// deadline-gated branch and the run survives; with a gateway answering, the 404
// branch kills it in one tick. The harness is pinned separately — this is the
// product half.
//
// WHY A TIME WINDOW AND NOT A COUNTER. `POST /api/runs/reconcile` is a public
// route and the smokes poll it in one-second loops, so "N consecutive 404s" can
// elapse in N seconds and is not evidence of anything. Elapsed time is.
//
// WHY NOT JUST LET THE DEADLINE CATCH IT. A run stuck `started` holds its
// mission `dispatched`, which holds the single-flight gate, which stalls the
// queue. Waiting the 125-minute default for a run the backend genuinely lost
// would be a worse lie than the one being fixed.
//
// WHY IN MEMORY AND NOT A COLUMN. Losing the map on restart costs one fresh
// grace window, which is arguably better evidence discipline — a new process
// making a new observation — and the deadline cap remains the backstop. A
// column would publish a process-local judgement as durable operator-facing
// truth, and nothing renders it.

jest.mock("@/lib/runs-repository", () => ({
  listActiveRuns: jest.fn(),
  updateRun: jest.fn(),
  getRun: jest.fn(),
}));
jest.mock("@/lib/missions/mission-repository", () => ({
  getMission: jest.fn(),
  updateMission: jest.fn(),
}));
jest.mock("@/lib/sessions/session-repository", () => ({
  closeSessionForMission: jest.fn(),
}));
jest.mock("@/lib/db", () => ({ now: jest.fn(() => new Date().toISOString()) }));
jest.mock("@/lib/runtime", () => ({
  runtime: { getRun: jest.fn(), stopRun: jest.fn(() => Promise.resolve()) },
}));
const mockFinalizeComposerNodeRun = jest.fn(() => null);
jest.mock("@/lib/composer/engine", () => ({
  finalizeComposerNodeRun: (...a: unknown[]) => mockFinalizeComposerNodeRun(...(a as [])),
  advanceComposerRun: jest.fn(() => Promise.resolve()),
}));

import {
  reconcileActiveRuns,
  resetNotFoundTracker,
  RUN_NOT_FOUND_GRACE_MS,
} from "@/lib/orchestration/run-reconcile";
import { listActiveRuns, updateRun, getRun as getLocalRun } from "@/lib/runs-repository";
import { getMission } from "@/lib/missions/mission-repository";
import { runtime } from "@/lib/runtime";
import { RuntimeRequestError } from "@/lib/runtime/types";

const mockListActiveRuns = listActiveRuns as jest.Mock;
const mockUpdateRun = updateRun as jest.Mock;
const mockGetMission = getMission as jest.Mock;
const mockGetRun = runtime.getRun as jest.Mock;
const mockGetLocalRun = getLocalRun as jest.Mock;

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

function makeRun(over: Record<string, unknown> = {}) {
  return {
    id: "r1", runId: "br1", missionId: "m1", scheduleId: null, profileName: null,
    sessionId: null, status: "started", output: null, usage: null, error: null,
    composerNodeRunId: null,
    submittedAt: minutesAgo(1), completedAt: null, updatedAt: minutesAgo(1),
    ...over,
  };
}

/** The gateway answering "I have never heard of this run". */
const notFound = () => Promise.reject(new RuntimeRequestError("run not found", 404));

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate"] });
  jest.setSystemTime(new Date("2026-08-31T12:00:00Z").getTime());
  resetNotFoundTracker();
  mockGetMission.mockReturnValue({ id: "m1" }); // no declared timeout
  mockGetLocalRun.mockImplementation(() => makeRun()); // still started unless a test says otherwise
});
afterEach(() => {
  jest.useRealTimers();
});

/** Advance both the fake clock and the tracker's notion of elapsed time. */
function advance(ms: number) {
  jest.setSystemTime(Date.now() + ms);
}

describe("a single 404 is not proof the run is gone", () => {
  it("leaves a mission run active on the first 404", async () => {
    mockListActiveRuns.mockReturnValue([makeRun()]);
    mockGetRun.mockImplementation(notFound);

    await reconcileActiveRuns();

    expect(mockUpdateRun).not.toHaveBeenCalled();
  });

  it("leaves a Composer stage alone on the first 404", async () => {
    mockListActiveRuns.mockReturnValue([makeRun({ composerNodeRunId: "cn1" })]);
    mockGetRun.mockImplementation(notFound);

    await reconcileActiveRuns();

    expect(mockUpdateRun).not.toHaveBeenCalled();
    expect(mockFinalizeComposerNodeRun).not.toHaveBeenCalled();
  });

  it("hammering reconcile does not shorten the window", async () => {
    // The anti-counter assertion. POST /api/runs/reconcile is public and the
    // smokes poll it every second, so "N consecutive 404s" is a measure of how
    // often somebody asked, not of how long the run has been missing.
    mockListActiveRuns.mockReturnValue([makeRun()]);
    mockGetRun.mockImplementation(notFound);

    for (let i = 0; i < 12; i += 1) {
      await reconcileActiveRuns();
      advance(200);
    }

    expect(mockUpdateRun).not.toHaveBeenCalled();
  });
});

describe("a 404 that persists is the backend's final answer", () => {
  it("fails the mission run once the grace has elapsed", async () => {
    mockListActiveRuns.mockReturnValue([makeRun()]);
    mockGetRun.mockImplementation(notFound);

    await reconcileActiveRuns();
    advance(RUN_NOT_FOUND_GRACE_MS + 1_000);
    await reconcileActiveRuns();

    // The verdict and its wording are unchanged — the grace delays the
    // conclusion, it never softens it.
    expect(mockUpdateRun).toHaveBeenCalledWith(
      "r1",
      expect.objectContaining({ status: "failed", error: "backend no longer has this run (404)" }),
    );
  });

  it("fails the Composer stage once the grace has elapsed", async () => {
    mockListActiveRuns.mockReturnValue([makeRun({ composerNodeRunId: "cn1" })]);
    mockGetRun.mockImplementation(notFound);

    await reconcileActiveRuns();
    advance(RUN_NOT_FOUND_GRACE_MS + 1_000);
    await reconcileActiveRuns();

    expect(mockUpdateRun).toHaveBeenCalledWith(
      "r1",
      expect.objectContaining({ error: "backend no longer has this stage run (404)" }),
    );
  });
});

describe("a run that comes back was never lost", () => {
  it("a successful poll between 404s restarts the window", async () => {
    // The case the instant-fail got wrong, and the reason a window beats a
    // counter: a gateway restarting mid-poll can 404 once and answer normally a
    // second later. That run was never gone.
    mockListActiveRuns.mockReturnValue([makeRun()]);

    mockGetRun.mockImplementationOnce(notFound);
    await reconcileActiveRuns();

    advance(RUN_NOT_FOUND_GRACE_MS - 5_000);
    mockGetRun.mockImplementationOnce(() => Promise.resolve({ status: "started" }));
    await reconcileActiveRuns();

    // Past the ORIGINAL window, but the clock restarted when it answered.
    advance(10_000);
    mockGetRun.mockImplementation(notFound);
    await reconcileActiveRuns();

    expect(mockUpdateRun).not.toHaveBeenCalled();
  });
});

describe("GREEN CONTROLS: nothing else about reconcile moves", () => {
  it("an unreachable gateway is still deadline-gated, not 404-gated", async () => {
    // ECONNREFUSED is a TypeError, never a RuntimeRequestError, so it must not
    // touch the 404 path at all — it waits for the run's deadline.
    mockListActiveRuns.mockReturnValue([makeRun({ submittedAt: minutesAgo(200), updatedAt: minutesAgo(200) })]);
    mockGetRun.mockImplementation(() => Promise.reject(new TypeError("fetch failed")));

    await reconcileActiveRuns();

    expect(mockUpdateRun).toHaveBeenCalledWith(
      "r1",
      expect.objectContaining({ error: "backend unreachable past the run deadline" }),
    );
  });

  it("a young unreachable run is still left alone", async () => {
    mockListActiveRuns.mockReturnValue([makeRun()]);
    mockGetRun.mockImplementation(() => Promise.reject(new TypeError("fetch failed")));

    await reconcileActiveRuns();

    expect(mockUpdateRun).not.toHaveBeenCalled();
  });

  it("a 500 from the gateway is transient, not a lost run", async () => {
    mockListActiveRuns.mockReturnValue([makeRun()]);
    mockGetRun.mockImplementation(() =>
      Promise.reject(new RuntimeRequestError("upstream boom", 500)),
    );

    await reconcileActiveRuns();

    expect(mockUpdateRun).not.toHaveBeenCalled();
  });

  it("a run past its deadline still fails even while inside a 404 grace", async () => {
    // The grace delays a 404 verdict; it must not become a way to outlive the
    // deadline. Otherwise a permanently-404ing backend would hold the
    // single-flight gate open indefinitely.
    mockListActiveRuns.mockReturnValue([makeRun({ submittedAt: minutesAgo(200), updatedAt: minutesAgo(200) })]);
    mockGetRun.mockImplementation(notFound);

    await reconcileActiveRuns();

    expect(mockUpdateRun).toHaveBeenCalledWith("r1", expect.objectContaining({ status: "failed" }));
  });

  it("a completed run still finalizes immediately", async () => {
    mockListActiveRuns.mockReturnValue([makeRun()]);
    mockGetRun.mockImplementation(() =>
      Promise.resolve({ status: "completed", output: "done" }),
    );

    await reconcileActiveRuns();

    expect(mockUpdateRun).toHaveBeenCalledWith(
      "r1",
      expect.objectContaining({ status: "completed" }),
    );
  });
});

describe("a decision made while we were waiting wins", () => {
  it("does not resurrect a run cancelled during the gateway await", async () => {
    // reconcile snapshots the active set and THEN awaits the gateway per row. A
    // cancel landing inside that await used to be overwritten by a verdict
    // computed before it happened -- putting a stopped run back to `completed`
    // and re-opening the mission behind it. T-0076 closed this on the Composer
    // side; this is the mission half, which predates it.
    mockListActiveRuns.mockReturnValue([makeRun()]);
    mockGetRun.mockImplementation(() => Promise.resolve({ status: "completed", output: "done" }));
    // By the time the await resolves, the row has been cancelled.
    mockGetLocalRun.mockImplementation(() => makeRun({ status: "cancelled" }));

    await reconcileActiveRuns();

    expect(mockUpdateRun).not.toHaveBeenCalled();
  });

  it("GREEN CONTROL: a run still started is finalized as normal", async () => {
    mockListActiveRuns.mockReturnValue([makeRun()]);
    mockGetRun.mockImplementation(() => Promise.resolve({ status: "completed", output: "done" }));

    await reconcileActiveRuns();

    expect(mockUpdateRun).toHaveBeenCalledWith(
      "r1",
      expect.objectContaining({ status: "completed" }),
    );
  });
});

describe("the two survivors mutation found", () => {
  it("a run whose row vanished mid-await is not finalized", async () => {
    // Deleting a mission cascades to its runs, so a row CAN disappear between
    // the snapshot and the verdict. Nothing is left to finalize, and writing
    // mission state for a run that no longer exists would be inventing history.
    // Found by mutation: every test supplied a row, so the branch was unreached
    // and either answer passed.
    mockListActiveRuns.mockReturnValue([makeRun()]);
    mockGetRun.mockImplementation(() => Promise.resolve({ status: "completed", output: "done" }));
    mockGetLocalRun.mockImplementation(() => null);

    await reconcileActiveRuns();

    expect(mockUpdateRun).not.toHaveBeenCalled();
  });

  it("an unreachable gateway never enters the 404 grace, even across it", async () => {
    // Found by mutation: the existing control used a run already past its
    // deadline, so routing ECONNREFUSED into the 404 branch changed nothing --
    // both paths failed it. A YOUNG run separates them. Under the correct code
    // it survives indefinitely until its deadline; under the mutant the 404
    // grace expires and kills it with the wrong reason.
    mockListActiveRuns.mockReturnValue([makeRun()]);
    mockGetRun.mockImplementation(() => Promise.reject(new TypeError("fetch failed")));

    await reconcileActiveRuns();
    advance(RUN_NOT_FOUND_GRACE_MS + 60_000);
    await reconcileActiveRuns();

    expect(mockUpdateRun).not.toHaveBeenCalled();
  });
});
