/** @jest-environment node */

// ═══════════════════════════════════════════════════════════════
// Choosing "Schedule" is not choosing "Run now".
//
// The composer's Dispatch step offers Save, Queue, Run now and Schedule as
// four separate choices, and the cadence picker under Schedule prints the next
// times it will fire. Both write paths then kicked off a run there and then:
// the dispatch handler and the promote handler each called dispatchMissionNow
// straight after createSchedule. An operator who deliberately did not pick
// "Run now" got one anyway, at a paid provider, before the first scheduled
// occurrence had come round.
//
// The contract: creating a schedule creates the schedule and nothing else. A
// run now is still one click away on the schedule's own Run button
// (POST /api/schedules/[id]/run), which is where an operator asks for one.
// ═══════════════════════════════════════════════════════════════

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
jest.mock("@/lib/models-repository", () => ({ findModelByModelId: () => null }));
jest.mock("@/lib/schedules-repository", () => ({
  createSchedule: (...a: unknown[]) => mockCreateSchedule(...a),
}));
jest.mock("@/lib/missions/mission-dispatch", () => ({
  dispatchMissionNow: (...a: unknown[]) => mockDispatchMissionNow(...a),
}));
jest.mock("@/lib/missions/mission-queue-tick", () => ({ runMissionQueueTick: jest.fn() }));
jest.mock("@/lib/missions/mission-response", () => ({
  // The status rides along, because "the schedule was written" and "a 201 came
  // back" are the two halves of the same claim here.
  missionResponse: (m: unknown, status?: number) => ({ mission: m, status: status ?? 200 }),
  enrichedMission: (m: unknown) => m,
}));
jest.mock("@/lib/audit-log", () => ({ appendAuditLine: jest.fn() }));
jest.mock("@/lib/api-logger", () => ({ logApiError: jest.fn(), serverErrorFromCatch: jest.fn() }));
jest.mock("@/lib/agents/roster", () => ({ resolveAgentSlug: (s: string) => s }));
jest.mock("@/lib/missions/mission-category-repository", () => ({ getMissionCategory: () => null }));
// eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories are hoisted above imports
jest.mock("@/lib/db", () => require("../helpers/mocks").dbMock({ now: () => "t", uuid: () => "u" }));

import { handleDispatchMission } from "@/lib/missions/mission-handlers/dispatch";
import { promoteMission } from "@/lib/missions/mission-promote-handler";
import { missionBoardColumn } from "@/lib/missions/mission-board";

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
    status: "queued",
    profileName: null,
  }));
  mockGetMission.mockReturnValue(draftMission);
  mockUpdateMission.mockImplementation((_id: string, updates: Record<string, unknown>) => ({
    ...draftMission,
    ...updates,
  }));
  mockCreateSchedule.mockReturnValue({ id: "sch_1" });
});

describe("creating a mission in Schedule mode", () => {
  it("writes the schedule", async () => {
    const res = await handleDispatchMission({
      instruction: "Do it",
      dispatchMode: "cron",
      schedule: "every 30m",
    });

    expect(res.status).toBe(201);
    expect(mockCreateSchedule).toHaveBeenCalledTimes(1);
    expect(mockCreateSchedule.mock.calls[0][0]).toMatchObject({
      missionId: "m_1",
      schedule: "every 30m",
      enabled: true,
    });
  });

  it("does not run the mission there and then", async () => {
    await handleDispatchMission({
      instruction: "Do it",
      dispatchMode: "cron",
      schedule: "every 30m",
    });

    expect(mockDispatchMissionNow).not.toHaveBeenCalled();
  });

  it("GREEN CONTROL: Run now still runs the mission there and then", async () => {
    await handleDispatchMission({ instruction: "Do it", dispatchMode: "now" });

    expect(mockDispatchMissionNow).toHaveBeenCalledTimes(1);
  });

  it("leaves the mission where the guide says it waits, which is Draft", async () => {
    await handleDispatchMission({
      instruction: "Do it",
      dispatchMode: "cron",
      schedule: "every 30m",
    });

    // createMission writes status 'queued' with queued_for_run unset, and this
    // branch does not touch it. That pair IS the board's Draft column, which is
    // what the missions guide now tells the operator to look in until the
    // schedule fires. Nothing hands it to the queue tick either: that reads
    // queued_for_run = 1.
    expect(mockUpdateMission).not.toHaveBeenCalled();
    expect(missionBoardColumn({ status: "queued", queuedForRun: undefined })).toBe("draft");
  });
});

describe("promoting a draft in Schedule mode", () => {
  it("writes the schedule", async () => {
    const res = await promoteMission({
      missionId: "m_draft1",
      dispatchMode: "cron",
      schedule: "0 9 * * *",
    });

    expect(res.ok).toBe(true);
    expect(mockCreateSchedule).toHaveBeenCalledTimes(1);
  });

  it("does not run the mission there and then", async () => {
    await promoteMission({
      missionId: "m_draft1",
      dispatchMode: "cron",
      schedule: "0 9 * * *",
    });

    expect(mockDispatchMissionNow).not.toHaveBeenCalled();
  });

  it("GREEN CONTROL: promoting with Run now still runs it", async () => {
    await promoteMission({ missionId: "m_draft1", dispatchMode: "now" });

    expect(mockDispatchMissionNow).toHaveBeenCalledTimes(1);
  });
});
