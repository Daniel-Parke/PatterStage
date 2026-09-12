/** @jest-environment node */

// The other two write paths that create a `schedules` row: dispatching a new
// mission with dispatchMode "cron", and promoting an existing one the same way.
// Both were happy to store `every 0m`, which is due again the instant it fires,
// so the scheduler dispatched a paid agent run on every tick forever. Both also
// kick off a first run immediately, so the typo cost money before the loop even
// started.
//
// The refusal has to land BEFORE the row is written, which is the same rule the
// never-fires refusal was moved up for.

const mockCreateMission = jest.fn();
const mockCreateSchedule = jest.fn();
const mockDispatchMissionNow = jest.fn().mockResolvedValue({ ok: true });
const mockGetMission = jest.fn();
const mockUpdateMission = jest.fn();

jest.mock("@/lib/missions/mission-repository", () => ({
  ...(jest.requireActual("@/lib/missions/mission-repository") as object),
  createMission: (...a: unknown[]) => mockCreateMission(...a),
  updateMission: (...a: unknown[]) => mockUpdateMission(...a),
  getMission: (...a: unknown[]) => mockGetMission(...a),
}));
jest.mock("@/lib/models/models-repository", () => ({ findModelByModelId: () => null }));
jest.mock("@/lib/schedule/schedules-repository", () => ({
  createSchedule: (...a: unknown[]) => mockCreateSchedule(...a),
}));
jest.mock("@/lib/missions/mission-dispatch", () => ({
  dispatchMissionNow: (...a: unknown[]) => mockDispatchMissionNow(...a),
}));
jest.mock("@/lib/missions/mission-queue-tick", () => ({ runMissionQueueTick: jest.fn() }));
jest.mock("@/lib/missions/mission-response", () => ({
  missionResponse: (m: unknown) => ({ mission: m }),
  enrichedMission: (m: unknown) => m,
}));
jest.mock("@/lib/api/audit-log", () => ({ appendAuditLine: jest.fn() }));
jest.mock("@/lib/api/api-logger", () => ({ logApiError: jest.fn(), serverErrorFromCatch: jest.fn() }));
jest.mock("@/lib/agents/roster", () => ({ resolveAgentSlug: (s: string) => s }));
jest.mock("@/lib/missions/mission-category-repository", () => ({ getMissionCategory: () => null }));
// eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories are hoisted above imports
jest.mock("@/lib/db", () => require("../helpers/mocks").dbMock({ now: () => "t", uuid: () => "u" }));

import { handleDispatchMission } from "@/lib/missions/mission-handlers/dispatch";
import { promoteMission } from "@/lib/missions/mission-promote-handler";

const draftMission = {
  id: "m_draft1",
  name: "Draft",
  prompt: "<hermes_mission></hermes_mission>",
  status: "queued",
  queuedForRun: false,
  profileName: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockCreateMission.mockImplementation((input: { name: string }) => ({
    id: "m_1",
    name: input.name,
    status: "draft",
    profileName: null,
  }));
  mockGetMission.mockReturnValue(draftMission);
  mockUpdateMission.mockImplementation((_id: string, updates: Record<string, unknown>) => ({
    ...draftMission,
    ...updates,
  }));
  mockCreateSchedule.mockReturnValue({ id: "sch_1" });
});

describe("dispatching a mission on a zero interval", () => {
  it("400s, names the minimum, and writes no mission and no schedule", async () => {
    const res = await handleDispatchMission({
      instruction: "Do it",
      dispatchMode: "cron",
      schedule: "every 0m",
    });

    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toContain("1 minute");
    expect(mockCreateMission).not.toHaveBeenCalled();
    expect(mockCreateSchedule).not.toHaveBeenCalled();
    expect(mockDispatchMissionNow).not.toHaveBeenCalled();
  });

  it("400s on an interval past the end of the calendar", async () => {
    const res = await handleDispatchMission({
      instruction: "Do it",
      dispatchMode: "cron",
      schedule: "every 999999999d",
    });

    expect(res.status).toBe(400);
    expect(mockCreateMission).not.toHaveBeenCalled();
  });

  it("GREEN CONTROL: a one-minute schedule still dispatches", async () => {
    const res = await handleDispatchMission({
      instruction: "Do it",
      dispatchMode: "cron",
      schedule: "every 1m",
    });

    expect(res.status).not.toBe(400);
    expect(mockCreateSchedule).toHaveBeenCalledTimes(1);
  });
});

describe("promoting a mission on a zero interval", () => {
  it("400s, names the minimum, and creates no schedule", async () => {
    const res = await promoteMission({
      missionId: "m_draft1",
      dispatchMode: "cron",
      schedule: "every 0m",
    });

    expect(res).toMatchObject({ ok: false, status: 400 });
    expect(res.ok === false && res.error).toContain("1 minute");
    expect(mockCreateSchedule).not.toHaveBeenCalled();
    expect(mockDispatchMissionNow).not.toHaveBeenCalled();
  });

  it("GREEN CONTROL: a real interval still promotes", async () => {
    const res = await promoteMission({
      missionId: "m_draft1",
      dispatchMode: "cron",
      schedule: "every 30m",
    });

    expect(res.ok).toBe(true);
    expect(mockCreateSchedule).toHaveBeenCalledTimes(1);
  });
});
