/* eslint-disable @typescript-eslint/no-require-imports */
/** @jest-environment node */

jest.mock("next/server", () => {
  class NextRequest {
    url: string;
    method: string;
    headers: Headers;
    private _body: string;
    constructor(url: string, init?: RequestInit) {
      this.url = url;
      this.method = init?.method ?? "GET";
      this.headers = new Headers(init?.headers as HeadersInit);
      this._body = typeof init?.body === "string" ? init.body : JSON.stringify(init?.body ?? {});
    }
    async json() {
      return JSON.parse(this._body);
    }
  }
  // Use a real class so `bodyResult instanceof NextResponse` works
  // (parseJsonBody returns a NextResponse on invalid JSON).
  class NextResponse {
    status: number;
    private _data: unknown;
    constructor(data: unknown, init?: ResponseInit) {
      this.status = init?.status ?? 200;
      this._data = data;
    }
    static json(data: unknown, init?: ResponseInit) {
      return new NextResponse(data, init);
    }
    async json() { return this._data; }
  }
  return { NextRequest, NextResponse };
});

jest.mock("@/lib/api-logger", () => ({ logApiError: jest.fn() }));
jest.mock("@/lib/api-auth", () => ({ requireAuth: jest.fn(() => null), isChReadOnly: jest.fn(() => false) }));
jest.mock("@/lib/audit-log", () => ({ appendAuditLine: jest.fn() }));
jest.mock("@/lib/mission-category-repository", () => ({ getCategory: jest.fn() }));
jest.mock("@/lib/backends", () => ({
  agentBackend: { syncMission: jest.fn() },
}));

const mockSyncMissionToCronJob = jest.fn().mockResolvedValue(true);

jest.mock("@/lib/mission-cron-sync", () => ({
  enrichMissionCron: jest.fn((m: unknown) => m),
  syncMissionToCronJob: (...args: unknown[]) => mockSyncMissionToCronJob(...args),
  pauseMissionCron: jest.fn(),
  deleteMissionCron: jest.fn(),
}));

jest.mock("@/lib/mission-repository", () => {
  const getMission = jest.fn();
  const updateMission = jest.fn();
  return {
    getMission,
    updateMission,
    listMissions: jest.fn(),
    createMission: jest.fn(),
    deleteMission: jest.fn(),
    buildMissionPrompt: jest.fn(),
    __getMission: getMission,
    __updateMission: updateMission,
  };
});

const missionRepo = require("@/lib/mission-repository") as Record<string, jest.Mock>;
const mockGetMission = missionRepo.__getMission;
const mockUpdateMission = missionRepo.__updateMission;

const baseMission = {
  id: "m_cron1",
  name: "Cron mission",
  prompt: "<hermes_mission></hermes_mission>",
  status: "dispatched",
  cronJobId: "cron-1",
  profileName: "default",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetMission.mockReturnValue({ ...baseMission });
  mockUpdateMission.mockImplementation((_id: string, updates: Record<string, unknown>) => ({
    ...baseMission,
    ...updates,
  }));
});

async function postRoute(body: Record<string, unknown>) {
  const route = require("@/app/api/missions/route") as {
    POST: (req: Request) => Promise<{ status: number; json(): Promise<Record<string, unknown>> }>;
  };
  const req = {
    json: async () => body,
  } as unknown as import("next/server").NextRequest;
  return route.POST(req);
}

describe("POST /api/missions — profile-only cron sync", () => {
  it("calls syncMissionToCronJob when only profileName changes", async () => {
    const res = await postRoute({
      action: "update",
      id: "m_cron1",
      profileName: "research",
    });

    expect(res.status).toBe(200);
    expect(mockSyncMissionToCronJob).toHaveBeenCalledWith("m_cron1");
    expect(mockUpdateMission).toHaveBeenCalledWith(
      "m_cron1",
      expect.objectContaining({ profileName: "research" }),
    );
  });
});
