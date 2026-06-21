/* eslint-disable @typescript-eslint/no-require-imports */
/** @jest-environment node */

/**
 * Tests for POST /api/missions delete action.
 * Note: the delete action currently calls deleteMission regardless of whether
 * loadMission returned null (route does not guard on loadMission result).
 * This test suite documents current behavior.
 */

jest.mock("next/server", () => {
  // NextResponse as a real class so `bodyResult instanceof NextResponse`
  // (used by parseJsonBody's callsite) works. See session-37 findings.
  const responses: Array<{ data: unknown; init?: ResponseInit }> = [];
  class NextResponse {
    ok: boolean;
    status: number;
    statusText: string;
    headers: Headers;
    private _data: unknown;
    constructor(data: unknown = null, init?: ResponseInit) {
      this._data = data;
      this.status = init?.status ?? 200;
      this.ok = this.status >= 200 && this.status < 300;
      this.statusText = this.status === 404 ? "Not Found" : "OK";
      this.headers = new Headers(init?.headers as HeadersInit);
    }
    json() { return Promise.resolve(this._data); }
    static json(data: unknown, init?: ResponseInit) {
      responses.push({ data, init });
      return new NextResponse(data, init);
    }
  }
  return {
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
    NextResponse,
    __responses: responses,
  };
});

jest.mock("@/lib/api-logger", () => ({ logApiError: jest.fn() }));

jest.mock("@/lib/api-auth", () => ({
  requireAuth: jest.fn(() => null),
  requireAuth: jest.fn(() => null),
  isReadOnly: jest.fn(() => false),
}));
jest.mock("@/lib/audit-log", () => ({ appendAuditLine: jest.fn() }));

jest.mock("@/lib/orchestration", () => ({
  cancelMissionRun: jest.fn(() => Promise.resolve({ ok: true })),
  dispatchMissionRun: jest.fn(() => Promise.resolve({ ok: true })),
}));

jest.mock("@/lib/schedules-repository", () => ({
  createSchedule: jest.fn(),
  deleteSchedulesForMission: jest.fn(),
}));

jest.mock("@/lib/mission-repository", () => {
  const getMission = jest.fn();
  const deleteMission = jest.fn();

  return {
    getMission,
    deleteMission,
    listMissions: jest.fn(),
    createMission: jest.fn(),
    updateMission: jest.fn(),
    buildMissionPrompt: jest.fn(),
    __getMission: getMission,
    __deleteMission: deleteMission,
  };
});

const repo = require("@/lib/mission-repository") as Record<string, jest.Mock>;
const mockDeleteMission = repo.__deleteMission;
const mockGetMission = repo.__getMission;

beforeEach(() => {
  jest.clearAllMocks();
  mockDeleteMission.mockReturnValue(true);
  mockGetMission.mockImplementation((id: string) =>
    id === "m_existing" ? { id: "m_existing", name: "Test" } : null,
  );
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
