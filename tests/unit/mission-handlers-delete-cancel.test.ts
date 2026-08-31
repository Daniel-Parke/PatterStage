// ═══════════════════════════════════════════════════════════════
// mission-handlers/{delete,cancel} — the invariants, not the shapes
//
// Replaces tests/unit/missions-delete-cancel-response.test.ts, which imported
// nothing from src/ and asserted things like `200 >= 200 && 200 < 300`. It
// could not fail if either handler regressed, yet its header claimed to cover
// them — a false safety signal, which is worse than no test. Meanwhile the two
// handlers it named had no coverage at all.
//
// Every assertion below fails if a real behaviour changes.
// ═══════════════════════════════════════════════════════════════

const mockGetMission = jest.fn();
const mockDeleteMission = jest.fn();
const mockUpdateMission = jest.fn();
jest.mock("@/lib/missions/mission-repository", () => ({
  getMission: (...a: unknown[]) => mockGetMission(...a),
  deleteMission: (...a: unknown[]) => mockDeleteMission(...a),
  updateMission: (...a: unknown[]) => mockUpdateMission(...a),
}));

const mockDeleteSchedulesForMission = jest.fn();
jest.mock("@/lib/schedules-repository", () => ({
  deleteSchedulesForMission: (...a: unknown[]) => mockDeleteSchedulesForMission(...a),
}));

const mockUpdateSession = jest.fn();
const mockCloseSessionForMission = jest.fn();
jest.mock("@/lib/sessions/session-repository", () => ({
  updateSession: (...a: unknown[]) => mockUpdateSession(...a),
  closeSessionForMission: (...a: unknown[]) => mockCloseSessionForMission(...a),
}));

// T-0070 moved the local record into one shared writer; these are its seams.
const mockGetLatestRunForMission = jest.fn(() => null as unknown);
const mockUpdateRun = jest.fn();
jest.mock("@/lib/runs-repository", () => ({
  getLatestRunForMission: (...a: unknown[]) => mockGetLatestRunForMission(...(a as [])),
  updateRun: (...a: unknown[]) => mockUpdateRun(...a),
}));

// T-0070 renamed this seam. The action handler now writes the local record
// itself (via the shared finaliser both entry points share) and triggers only
// the REMOTE half in the background, so what it fires is the backend stop.
const mockCancelMissionRun = jest.fn(() => Promise.resolve());
jest.mock("@/lib/orchestration", () => ({
  cancelMissionRun: jest.fn(),
  stopBackendRunForMission: (_id: string) => mockCancelMissionRun(),
}));

const mockAppendAuditLine = jest.fn();
jest.mock("@/lib/audit-log", () => ({
  appendAuditLine: (...a: unknown[]) => mockAppendAuditLine(...a),
}));

const mockLogApiError = jest.fn();
jest.mock("@/lib/api-logger", () => ({
  logApiError: (...a: unknown[]) => mockLogApiError(...a),
}));

jest.mock("@/lib/missions/mission-category-repository", () => ({
  getCategory: jest.fn(() => null),
}));

import type { Mission } from "@/lib/missions/mission-types";
import { handleDeleteMission } from "@/lib/missions/mission-handlers/delete";
import { handleCancelMission } from "@/lib/missions/mission-handlers/cancel";

function mission(over: Partial<Mission> = {}): Mission {
  return {
    id: "m1",
    name: "Demo",
    prompt: "do the thing",
    status: "queued",
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...over,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCancelMissionRun.mockReturnValue(Promise.resolve());
});

describe("handleDeleteMission", () => {
  it("400s when the body carries no id", async () => {
    const res = handleDeleteMission({});
    expect(res.status).toBe(400);
    expect(mockDeleteMission).not.toHaveBeenCalled();
    expect(mockDeleteSchedulesForMission).not.toHaveBeenCalled();
  });

  it("404s for an unknown mission without touching schedules", () => {
    mockGetMission.mockReturnValue(null);
    const res = handleDeleteMission({ id: "nope" });
    expect(res.status).toBe(404);
    expect(mockDeleteSchedulesForMission).not.toHaveBeenCalled();
  });

  it("accepts missionId as well as id", () => {
    mockGetMission.mockReturnValue(mission());
    mockDeleteMission.mockReturnValue(true);
    expect(handleDeleteMission({ missionId: "m1" }).status).toBe(200);
    expect(mockGetMission).toHaveBeenCalledWith("m1");
  });

  it("deletes the schedule BEFORE the mission", () => {
    // The reason this handler exists: a surviving schedule makes the scheduler
    // tick dispatch a mission that is gone. Order is the invariant, so assert
    // the call order rather than merely that both happened.
    const order: string[] = [];
    mockGetMission.mockReturnValue(mission());
    mockDeleteSchedulesForMission.mockImplementation(() => order.push("schedule"));
    mockDeleteMission.mockImplementation(() => {
      order.push("mission");
      return true;
    });

    const res = handleDeleteMission({ id: "m1" });

    expect(res.status).toBe(200);
    expect(order).toEqual(["schedule", "mission"]);
  });

  it("404s when the row vanishes between lookup and delete", () => {
    mockGetMission.mockReturnValue(mission());
    mockDeleteMission.mockReturnValue(false);
    const res = handleDeleteMission({ id: "m1" });
    expect(res.status).toBe(404);
    expect(mockAppendAuditLine).not.toHaveBeenCalled();
  });

  it("returns the deleted id and writes one audit line", async () => {
    mockGetMission.mockReturnValue(mission());
    mockDeleteMission.mockReturnValue(true);

    const res = handleDeleteMission({ id: "m1" });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ data: { deleted: "m1" } });
    expect(mockAppendAuditLine).toHaveBeenCalledTimes(1);
    expect(mockAppendAuditLine).toHaveBeenCalledWith(
      expect.objectContaining({ action: "mission.delete", resource: "m1", ok: true }),
    );
  });
});

describe("handleCancelMission", () => {
  it("404s for an unknown mission", () => {
    mockGetMission.mockReturnValue(null);
    expect(handleCancelMission({ id: "nope" }).status).toBe(404);
    expect(mockUpdateMission).not.toHaveBeenCalled();
  });

  it("records a cancellation as failed, because there is no cancelled state", () => {
    // The V1 status enum has no `cancelled`. If someone adds one and updates
    // only the enum, this catches the half-migration.
    mockGetMission.mockReturnValue(mission({ status: "queued" }));
    mockUpdateMission.mockReturnValue(mission({ status: "failed" }));

    handleCancelMission({ id: "m1" });

    expect(mockUpdateMission).toHaveBeenCalledWith(
      "m1",
      expect.objectContaining({ status: "failed", result: "Cancelled by user" }),
    );
  });

  it("clears queuedForRun so the queue worker cannot re-dispatch it", () => {
    mockGetMission.mockReturnValue(mission({ status: "queued" }));
    mockUpdateMission.mockReturnValue(mission({ status: "failed" }));

    handleCancelMission({ id: "m1" });

    expect(mockUpdateMission).toHaveBeenCalledWith(
      "m1",
      expect.objectContaining({ queuedForRun: false }),
    );
  });

  it("stops the backend run only for a dispatched mission", async () => {
    mockGetMission.mockReturnValue(mission({ status: "dispatched" }));
    mockUpdateMission.mockReturnValue(mission({ status: "failed" }));

    const res = handleCancelMission({ id: "m1" });

    expect(mockCancelMissionRun).toHaveBeenCalledTimes(1);
    await expect(res.json()).resolves.toMatchObject({
      data: { cancel: { accepted: true, processKillPending: true } },
    });
  });

  it("does not stop a run for a mission that was never dispatched", async () => {
    mockGetMission.mockReturnValue(mission({ status: "queued" }));
    mockUpdateMission.mockReturnValue(mission({ status: "failed" }));

    const res = handleCancelMission({ id: "m1" });

    expect(mockCancelMissionRun).not.toHaveBeenCalled();
    await expect(res.json()).resolves.toMatchObject({
      data: { cancel: { processKillPending: false } },
    });
  });

  it("marks the linked session failed with the cancellation reason", () => {
    // CHANGED DELIBERATELY at T-0070. This asserted updateSession(mission.sessionId, …),
    // which is a strictly weaker close: it never set an exit code, and it did
    // nothing at all unless the MISSION row happened to carry a sessionId --
    // while the other cancel entry point was already using
    // closeSessionForMission, which resolves the session from the mission and
    // records 143. Two writers, two closes. There is now one, and 143 is the
    // same marker the agent's own `interrupt` end-reason maps to.
    mockGetMission.mockReturnValue(mission({ status: "queued", sessionId: "s1" }));
    mockUpdateMission.mockReturnValue(mission({ status: "failed", sessionId: "s1" }));

    handleCancelMission({ id: "m1" });

    expect(mockCloseSessionForMission).toHaveBeenCalledWith(
      "m1",
      expect.objectContaining({ status: "failed", error: "Cancelled by user", exitCode: 143 }),
    );
  });

  it("closes the session even when the mission row carries no sessionId", () => {
    // The replacement for "skips the session update when the mission has no
    // session", and the reason that behaviour was worth losing: a mission whose
    // sessionId was never written back left its session `active` forever. The
    // repository resolves the session from the mission, so the handler no
    // longer has to know.
    mockGetMission.mockReturnValue(mission({ status: "queued" }));
    mockUpdateMission.mockReturnValue(mission({ status: "failed" }));

    handleCancelMission({ id: "m1" });

    expect(mockCloseSessionForMission).toHaveBeenCalledWith("m1", expect.anything());
  });

  it("still cancels when the session update throws, and logs it", () => {
    // The catch here is deliberate: a session write failure must not strand a
    // mission the operator asked to cancel. But it must be logged, not eaten.
    mockGetMission.mockReturnValue(mission({ status: "queued", sessionId: "s1" }));
    mockUpdateMission.mockReturnValue(mission({ status: "failed", sessionId: "s1" }));
    // Once, not permanently: clearAllMocks resets calls but keeps
    // implementations, and closeSessionForMission is now called on EVERY cancel
    // rather than only when the mission row carried a sessionId -- so a
    // permanent throw here leaks into the next test.
    mockCloseSessionForMission.mockImplementationOnce(() => {
      throw new Error("db locked");
    });

    const res = handleCancelMission({ id: "m1" });

    expect(res.status).toBe(200);
    expect(mockLogApiError).toHaveBeenCalledTimes(1);
    expect(mockAppendAuditLine).toHaveBeenCalledWith(
      expect.objectContaining({ action: "mission.cancel", resource: "m1", ok: true }),
    );
  });

  it("does not let a backend stop failure reject into the request path", async () => {
    // cancelMissionRun is fired with `void ... .catch()`. If that catch is ever
    // dropped, this surfaces as an unhandled rejection instead of a green test.
    mockGetMission.mockReturnValue(mission({ status: "dispatched" }));
    mockUpdateMission.mockReturnValue(mission({ status: "failed" }));
    mockCancelMissionRun.mockReturnValue(Promise.reject(new Error("gateway down")));

    const res = handleCancelMission({ id: "m1" });

    expect(res.status).toBe(200);
    await Promise.resolve();
    await Promise.resolve();
    expect(mockLogApiError).toHaveBeenCalledTimes(1);
  });
});
