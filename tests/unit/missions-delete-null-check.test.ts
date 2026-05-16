/* eslint-disable @typescript-eslint/no-require-imports */
/** @jest-environment node */

/**
 * Tests for POST /api/missions delete action.
 * Note: the delete action currently calls deleteMission regardless of whether
 * loadMission returned null (route does not guard on loadMission result).
 * This test suite documents current behavior.
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
        statusText: status === 404 ? "Not Found" : "OK",
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
  requireNotReadOnly: jest.fn(() => null),
}));
jest.mock("@/lib/audit-log", () => ({ appendAuditLine: jest.fn() }));

jest.mock("@/lib/backends", () => ({
  agentBackend: {
    dispatchMission: jest.fn(),
    pauseMission: jest.fn(),
    resumeMission: jest.fn(),
    cancelMission: jest.fn(),
    getMissionStatus: jest.fn(),
  },
}));

jest.mock("@/lib/jobs-repository", () => ({
  readJobsFile: jest.fn(),
  writeJobsFile: jest.fn(),
  withJobsFileLock: jest.fn(),
}));

// Mock mission-repository using require() factory
jest.mock("@/lib/mission-repository", () => {
  const loadMission = jest.fn();
  const saveMission = jest.fn();
  const deleteMission = jest.fn();
  const listMissions = jest.fn();

  return {
    ensureMissionsDir: jest.fn(),
    getMissionsDataDir: jest.fn(() => "/tmp/test-hermes/missions"),
    loadMission,
    saveMission,
    deleteMission,
    listMissions,
    sanitizeMissionId: jest.fn((id: string) => id.replace(/[^a-zA-Z0-9_-]/g, "")),
    __loadMission: loadMission,
    __saveMission: saveMission,
    __deleteMission: deleteMission,
    __listMissions: listMissions,
  };
});

const repo = require("@/lib/mission-repository") as Record<string, jest.Mock>;
const mockDeleteMission = repo.__deleteMission;

beforeEach(() => {
  jest.clearAllMocks();
  mockDeleteMission.mockReturnValue(true);
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

describe("POST /api/missions — delete action", () => {
  it("successfully deletes an existing mission", async () => {
    // getMission is NOT mocked (it's the real function), so it returns undefined/null
    // The route only checks deleteMission's return value
    mockDeleteMission.mockReturnValue(true);

    const res = await postRoute({ action: "delete", missionId: "m_existing" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect((body as { data: { deleted: string } }).data.deleted).toBe("m_existing");
  });

  it("returns 404 when mission does not exist", async () => {
    // deleteMission returns false for non-existent missions
    mockDeleteMission.mockReturnValue(false);

    const res = await postRoute({ action: "delete", missionId: "m_nonexistent" });
    expect(res.status).toBe(404);
  });

  it("returns 400 when missionId is missing", async () => {
    const res = await postRoute({ action: "delete" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when missionId is an empty string", async () => {
    const res = await postRoute({ action: "delete", missionId: "" });
    expect(res.status).toBe(400);
  });
});
