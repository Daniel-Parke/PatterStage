/** @jest-environment node */

// K4 — self-healing single-flight. A run stuck in 'started' keeps its mission
// 'dispatched', which blocks the scheduler (hasDispatchedMission). Reconcile must
// fail clearly-stuck runs so the gate clears, WITHOUT killing legitimately-running
// untimed missions the backend still reports running.

jest.mock("@/lib/runs-repository", () => ({
  listActiveRuns: jest.fn(),
  updateRun: jest.fn(),
  // reconcile re-reads the row before finalizing, so a cancellation landing
  // during the gateway await is not overwritten by a stale verdict (T-0078).
  // This mock previously omitted it and passed only because a missing row was
  // treated as "still active"; those semantics are now explicit and inverted.
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

import { reconcileActiveRuns } from "@/lib/orchestration/run-reconcile";
import { listActiveRuns, updateRun, getRun as getLocalRun } from "@/lib/runs-repository";
import { getMission, updateMission } from "@/lib/missions/mission-repository";
import { runtime } from "@/lib/runtime";

const mockListActiveRuns = listActiveRuns as jest.Mock;
const mockUpdateRun = updateRun as jest.Mock;
const mockGetMission = getMission as jest.Mock;
const mockUpdateMission = updateMission as jest.Mock;
const mockGetRun = runtime.getRun as jest.Mock;
const mockStopRun = runtime.stopRun as jest.Mock;

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

function makeRun(submittedAt: string) {
  return {
    id: "r1", runId: "br1", missionId: "m1", scheduleId: null, profileName: null,
    sessionId: null, status: "started", output: null, usage: null, error: null,
    submittedAt, completedAt: null, updatedAt: submittedAt,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetMission.mockReturnValue({ id: "m1" }); // no declared timeout by default
  (getLocalRun as jest.Mock).mockImplementation(() => makeRun(minutesAgo(1)));
});

describe("reconcile self-heal — stuck single-flight (K4)", () => {
  it("fails a run when the backend is unreachable past the default deadline", async () => {
    mockListActiveRuns.mockReturnValue([makeRun(minutesAgo(200))]);
    mockGetRun.mockRejectedValue(new Error("ECONNREFUSED"));

    await reconcileActiveRuns();

    expect(mockUpdateRun).toHaveBeenCalledWith("r1", expect.objectContaining({ status: "failed" }));
    expect(mockUpdateMission).toHaveBeenCalledWith("m1", expect.objectContaining({ status: "failed" }));
  });

  it("leaves a recent run active when the backend is transiently unreachable", async () => {
    mockListActiveRuns.mockReturnValue([makeRun(minutesAgo(5))]);
    mockGetRun.mockRejectedValue(new Error("ECONNREFUSED"));

    await reconcileActiveRuns();

    expect(mockUpdateRun).not.toHaveBeenCalled();
  });

  it("enforces a declared timeout even while the backend still reports running", async () => {
    mockGetMission.mockReturnValue({ id: "m1", timeoutMinutes: 10 });
    mockListActiveRuns.mockReturnValue([makeRun(minutesAgo(20))]);
    mockGetRun.mockResolvedValue({ status: "started" });

    await reconcileActiveRuns();

    expect(mockStopRun).toHaveBeenCalled();
    expect(mockUpdateRun).toHaveBeenCalledWith("r1", expect.objectContaining({ status: "failed" }));
  });

  it("does NOT kill an untimed long run the backend reports still running", async () => {
    mockGetMission.mockReturnValue({ id: "m1" }); // no timeout
    mockListActiveRuns.mockReturnValue([makeRun(minutesAgo(200))]);
    mockGetRun.mockResolvedValue({ status: "started" });

    await reconcileActiveRuns();

    expect(mockUpdateRun).not.toHaveBeenCalled();
  });
});
