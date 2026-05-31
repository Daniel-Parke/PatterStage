/* eslint-disable @typescript-eslint/no-require-imports */
/** @jest-environment node */

jest.mock("next/server", () => ({
  NextRequest: class NextRequest {},
  NextResponse: {
    json: (data: unknown, init?: ResponseInit) => ({
      ok: (init?.status ?? 200) >= 200 && (init?.status ?? 200) < 300,
      status: init?.status ?? 200,
      json: () => Promise.resolve(data),
    }),
  },
}));

jest.mock("@/lib/api-logger", () => ({ logApiError: jest.fn() }));
jest.mock("@/lib/api-auth", () => ({ requireAuth: jest.fn(() => null), isChReadOnly: jest.fn(() => false) }));
jest.mock("@/lib/audit-log", () => ({ appendAuditLine: jest.fn() }));
jest.mock("@/lib/mission-category-repository", () => ({ getCategory: jest.fn() }));
jest.mock("@/lib/profiles-repository", () => ({ listProfiles: jest.fn(() => []) }));
jest.mock("@/lib/cron-repository", () => ({
  createCronJob: jest.fn(),
  deleteCronJob: jest.fn(),
  importHermesJobs: jest.fn(),
  pushJobToHermes: jest.fn(),
}));

const mockDispatchMissionNow = jest.fn().mockResolvedValue({ ok: true });

jest.mock("@/lib/mission-dispatch", () => ({
  dispatchMissionNow: (...args: unknown[]) => mockDispatchMissionNow(...args),
}));

jest.mock("@/lib/mission-cron-sync", () => ({
  enrichMissionCron: jest.fn((m: unknown) => m),
  syncMissionToCronJob: jest.fn(),
  pauseMissionCron: jest.fn(),
  deleteMissionCron: jest.fn(),
}));

jest.mock("@/lib/sync", () => ({ ensureSyncLayer: jest.fn() }));

const mockRunMissionQueueTick = jest.fn();

jest.mock("@/lib/mission-queue-tick", () => ({
  runMissionQueueTick: (...args: unknown[]) => mockRunMissionQueueTick(...args),
}));

const mockCreateMission = jest.fn();
const mockUpdateMission = jest.fn();
const mockGetMission = jest.fn();

jest.mock("@/lib/mission-repository", () => ({
  createMission: (...args: unknown[]) => mockCreateMission(...args),
  updateMission: (...args: unknown[]) => mockUpdateMission(...args),
  getMission: (...args: unknown[]) => mockGetMission(...args),
  listMissions: jest.fn(() => []),
  deleteMission: jest.fn(),
  buildMissionPrompt: jest.fn(() => "<hermes_mission></hermes_mission>"),
  getNextQueuedMission: jest.fn(),
  hasDispatchedMission: jest.fn(),
}));

const createdMission = {
  id: "m_queue1",
  name: "Queued",
  prompt: "<hermes_mission></hermes_mission>",
  status: "queued",
};

beforeEach(() => {
  jest.clearAllMocks();
  mockCreateMission.mockReturnValue(createdMission);
  mockGetMission.mockReturnValue(createdMission);
  mockUpdateMission.mockImplementation((_id: string, updates: Record<string, unknown>) => ({
    ...createdMission,
    ...updates,
  }));
});

async function postDispatch(dispatchMode: string) {
  const route = require("@/app/api/missions/route") as {
    POST: (req: import("next/server").NextRequest) => Promise<{ status: number }>;
  };
  const req = {
    json: async () => ({
      action: "dispatch",
      name: "Queued",
      instruction: "Run task",
      dispatchMode,
    }),
  } as unknown as import("next/server").NextRequest;
  return route.POST(req);
}

describe("POST /api/missions — queue dispatch mode", () => {
  it("sets queuedForRun and does not dispatch immediately for queue mode", async () => {
    const res = await postDispatch("queue");
    expect(res.status).toBe(201);
    expect(mockUpdateMission).toHaveBeenCalledWith("m_queue1", { queuedForRun: true });
    expect(mockDispatchMissionNow).not.toHaveBeenCalled();
    expect(mockRunMissionQueueTick).toHaveBeenCalled();
  });

  it("sets queuedForRun false for save mode and does not dispatch", async () => {
    const res = await postDispatch("save");
    expect(res.status).toBe(201);
    expect(mockUpdateMission).toHaveBeenCalledWith("m_queue1", { queuedForRun: false });
    expect(mockDispatchMissionNow).not.toHaveBeenCalled();
  });

  it("dispatches immediately for now mode", async () => {
    const res = await postDispatch("now");
    expect(res.status).toBe(201);
    expect(mockDispatchMissionNow).toHaveBeenCalledWith(
      "m_queue1",
      expect.objectContaining({}),
    );
  });
});

describe("MissionQueueSync", () => {
  it("reports success when queue tick dispatches a mission", async () => {
    mockRunMissionQueueTick.mockResolvedValue({
      ran: true,
      missionId: "m_queue1",
      ok: true,
    });

    const { MissionQueueSync } = require("@/lib/sync/sources/MissionQueueSync") as {
      MissionQueueSync: new () => { sync(): Promise<{ success: boolean; syncedCount: number }> };
    };
    const sync = new MissionQueueSync();
    const result = await sync.sync();

    expect(result.success).toBe(true);
    expect(result.syncedCount).toBe(1);
    expect(mockRunMissionQueueTick).toHaveBeenCalled();
  });
});
