/* eslint-disable @typescript-eslint/no-require-imports */
/** @jest-environment node */

/**
 * Tests for POST /api/missions update action.
 * Note: the update action only handles status and result fields.
 * Skills/profile sync to cron jobs is NOT implemented in the update action.
 */

jest.mock("next/server", () => ({
  NextRequest: class NextRequest {
    url: string;
    method: string;
    headers: Headers;
    bodyUsed: boolean = false;
    private _body: string;
    constructor(url: string, init?: RequestInit) {
      this.url = url;
      this.method = init?.method ?? "GET";
      this.headers = new Headers(init?.headers as HeadersInit);
      this._body = typeof init?.body === "string" ? init.body : JSON.stringify(init?.body ?? {});
    }
    async json() { return JSON.parse(this._body); }
  },
  NextResponse: {
    json: (data: unknown, init?: ResponseInit) => {
      const status = init?.status ?? 200;
      const res = {
        ok: status >= 200 && status < 300,
        status,
        statusText: "OK",
        headers: new Headers(),
        json: () => Promise.resolve(data),
      };
      return res;
    },
  },
}));

jest.mock("@/lib/api-logger", () => ({ logApiError: jest.fn() }));

jest.mock("@/lib/api-auth", () => ({
  requireAuth: jest.fn(() => null),
  requireMcApiKey: jest.fn(() => null),
  requireNotReadOnly: jest.fn(() => null),
}));

jest.mock("@/lib/audit-log", () => ({
  appendAuditLine: jest.fn(),
}));

jest.mock("@/lib/backends", () => ({
  agentBackend: {
    dispatchMission: jest.fn(),
    pauseMission: jest.fn(),
    resumeMission: jest.fn(),
    cancelMission: jest.fn(),
    getMissionStatus: jest.fn(),
  },
}));

// Mock mission-repository with require() factory
jest.mock("@/lib/mission-repository", () => {
  const loadMission = jest.fn();
  const saveMission = jest.fn();
  const updateMission = jest.fn();
  const listMissions = jest.fn();

  return {
    ensureMissionsDir: jest.fn(),
    getMissionsDataDir: jest.fn(() => "/tmp/test-hermes/missions"),
    loadMission,
    saveMission,
    updateMission,
    listMissions,
    sanitizeMissionId: jest.fn((id: string) => id.replace(/[^a-zA-Z0-9_-]/g, "")),
    __loadMission: loadMission,
    __saveMission: saveMission,
    __updateMission: updateMission,
    __listMissions: listMissions,
  };
});

const missionRepo = require("@/lib/mission-repository") as Record<string, jest.Mock>;
const mockUpdateMission = missionRepo.__updateMission;
const mockLoadMission = missionRepo.__loadMission;
const mockSaveMission = missionRepo.__saveMission;

const mockMissionData = {
  id: "m_test123",
  name: "Test Mission",
  prompt: "Original prompt",
  goals: ["Goal 1"],
  skills: ["old-skill"],
  model: "test-model",
  profile: "old-profile",
  missionTimeMinutes: 15,
  timeoutMinutes: 10,
  schedule: "every 5m",
  status: "dispatched" as const,
  dispatchMode: "cron" as const,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  results: null,
  duration: null,
  error: null,
  templateId: null,
  cronJobId: "mission-m_test123",
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUpdateMission.mockReturnValue({ ...mockMissionData });
  mockLoadMission.mockReturnValue({ ...mockMissionData });
  mockSaveMission.mockReturnValue(undefined);
});

async function postRoute(body: Record<string, unknown>) {
  const route = require("@/app/api/missions/route") as { POST: (req: Request) => unknown };
  const req = {
    url: "http://localhost/api/missions",
    method: "POST",
    headers: new Headers({ "content-type": "application/json" }),
    body: JSON.stringify(body),
    json: async () => body,
  } as unknown as Request;
  return route.POST(req) as unknown as { status: number; json(): Promise<Record<string, unknown>> };
}

describe("POST /api/missions — update action", () => {
  it("updates mission status", async () => {
    mockUpdateMission.mockReturnValue({ ...mockMissionData, status: "dispatched" });

    const res = await postRoute({ action: "update", id: "m_test123", status: "dispatched" });
    expect(res.status).toBe(200);
    expect(mockUpdateMission).toHaveBeenCalledWith("m_test123", { status: "dispatched" });
  });

  it("updates mission result", async () => {
    mockUpdateMission.mockReturnValue({ ...mockMissionData, result: "completed successfully" });

    const res = await postRoute({ action: "update", id: "m_test123", result: "completed successfully" });
    expect(res.status).toBe(200);
    expect(mockUpdateMission).toHaveBeenCalledWith("m_test123", { result: "completed successfully" });
  });

  it("returns 400 when mission id is missing", async () => {
    const res = await postRoute({ action: "update", status: "dispatched" });
    expect(res.status).toBe(400);
  });

  it("returns 404 when mission not found", async () => {
    mockUpdateMission.mockReturnValue(null);

    const res = await postRoute({ action: "update", id: "nonexistent", status: "dispatched" });
    expect(res.status).toBe(404);
  });

  it("does NOT call withJobsFileLock for status-only updates (no cron sync)", async () => {
    const res = await postRoute({ action: "update", id: "m_test123", status: "dispatched" });
    expect(res.status).toBe(200);
  });

  it("updates both status and result in one call", async () => {
    mockUpdateMission.mockReturnValue({ ...mockMissionData, status: "failed", result: "crashed" });

    const res = await postRoute({ action: "update", id: "m_test123", status: "failed", result: "crashed" });
    expect(res.status).toBe(200);
    expect(mockUpdateMission).toHaveBeenCalledWith("m_test123", { status: "failed", result: "crashed" });
  });
});
