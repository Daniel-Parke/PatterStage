/* eslint-disable @typescript-eslint/no-require-imports */
/** @jest-environment node */

jest.mock("@/lib/api-logger", () => ({ logApiError: jest.fn() }));
jest.mock("@/lib/schedules-repository", () => ({
  createSchedule: jest.fn(() => ({ id: "sched1" })),
}));
const mockDispatchMissionNow = jest.fn().mockResolvedValue({ ok: true });
const mockRunMissionQueueTick = jest.fn();

jest.mock("@/lib/missions/mission-dispatch", () => ({
  dispatchMissionNow: (...args: unknown[]) => mockDispatchMissionNow(...args),
}));

jest.mock("@/lib/missions/mission-queue-tick", () => ({
  runMissionQueueTick: (...args: unknown[]) => mockRunMissionQueueTick(...args),
}));

const mockGetMission = jest.fn();
const mockUpdateMission = jest.fn();

jest.mock("@/lib/missions/mission-repository", () => ({
  getMission: (...args: unknown[]) => mockGetMission(...args),
  updateMission: (...args: unknown[]) => mockUpdateMission(...args),
}));

const draftMission = {
  id: "m_draft1",
  name: "Draft",
  prompt: "<hermes_mission></hermes_mission>",
  status: "queued",
  queuedForRun: false,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetMission.mockReturnValue(draftMission);
  mockUpdateMission.mockImplementation(
    (_id: string, updates: Record<string, unknown>) => ({
      ...draftMission,
      ...updates,
    }),
  );
});

describe("promoteMission", () => {
  it("sets queuedForRun false for save promote", async () => {
    const { promoteMission } = require("@/lib/missions/mission-promote-handler") as {
      promoteMission: (input: { missionId: string; dispatchMode: string }) => Promise<{ ok: boolean }>;
    };
    const result = await promoteMission({
      missionId: "m_draft1",
      dispatchMode: "save",
    });
    expect(result.ok).toBe(true);
    expect(mockUpdateMission).toHaveBeenCalledWith(
      "m_draft1",
      expect.objectContaining({ queuedForRun: false }),
    );
    expect(mockDispatchMissionNow).not.toHaveBeenCalled();
  });

  it("sets queuedForRun true and ticks queue for queue promote", async () => {
    const { promoteMission } = require("@/lib/missions/mission-promote-handler") as {
      promoteMission: (input: { missionId: string; dispatchMode: string }) => Promise<{ ok: boolean }>;
    };
    const result = await promoteMission({
      missionId: "m_draft1",
      dispatchMode: "queue",
    });
    expect(result.ok).toBe(true);
    expect(mockUpdateMission).toHaveBeenCalledWith(
      "m_draft1",
      expect.objectContaining({ queuedForRun: true }),
    );
    expect(mockRunMissionQueueTick).toHaveBeenCalled();
    expect(mockDispatchMissionNow).not.toHaveBeenCalled();
  });

  it("dispatches immediately for now promote", async () => {
    const { promoteMission } = require("@/lib/missions/mission-promote-handler") as {
      promoteMission: (input: { missionId: string; dispatchMode: string }) => Promise<{ ok: boolean }>;
    };
    const result = await promoteMission({
      missionId: "m_draft1",
      dispatchMode: "now",
    });
    expect(result.ok).toBe(true);
    expect(mockDispatchMissionNow).toHaveBeenCalledWith(
      "m_draft1",
      expect.any(Object),
    );
  });

  it("rejects promote for dispatched missions", async () => {
    mockGetMission.mockReturnValue({
      ...draftMission,
      status: "dispatched",
      queuedForRun: false,
    });
    const { promoteMission } = require("@/lib/missions/mission-promote-handler") as {
      promoteMission: (input: { missionId: string; dispatchMode: string }) => Promise<{
        ok: boolean;
        status?: number;
      }>;
    };
    const result = await promoteMission({
      missionId: "m_draft1",
      dispatchMode: "now",
    });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
  });
});
