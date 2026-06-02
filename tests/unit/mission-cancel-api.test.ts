/* eslint-disable @typescript-eslint/no-require-imports */
/** @jest-environment node */

jest.mock("next/server", () => {
  const responses: Array<{ data: unknown; init?: ResponseInit }> = [];
  // NextResponse as a real class so `bodyResult instanceof NextResponse`
  // (used by parseJsonBody's callsite) works. See session-37 findings.
  class NextResponse {
    ok: boolean;
    status: number;
    private _data: unknown;
    constructor(data: unknown = null, init?: ResponseInit) {
      this._data = data;
      this.status = init?.status ?? 200;
      this.ok = this.status >= 200 && this.status < 300;
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
    },
    NextResponse,
    __responses: responses,
  };
});

jest.mock("@/lib/api-logger", () => ({ logApiError: jest.fn() }));
jest.mock("@/lib/api-auth", () => ({ requireAuth: jest.fn(() => null), isChReadOnly: jest.fn(() => false) }));
jest.mock("@/lib/audit-log", () => ({ appendAuditLine: jest.fn() }));

let cancelResolve: (() => void) | null = null;
const mockCancelMission = jest.fn(
  () =>
    new Promise<{ processKilled: boolean; error: string | null }>((resolve) => {
      cancelResolve = () => resolve({ processKilled: true, error: null });
    }),
);

jest.mock("@/lib/backends", () => ({
  agentBackend: {
    cancelMission: (...args: unknown[]) => mockCancelMission(...args),
  },
}));

const mockGetMission = jest.fn();
const mockUpdateMission = jest.fn();

jest.mock("@/lib/mission-repository", () => ({
  getMission: (...args: unknown[]) => mockGetMission(...args),
  updateMission: (...args: unknown[]) => mockUpdateMission(...args),
  listMissions: jest.fn(),
  createMission: jest.fn(),
  deleteMission: jest.fn(),
  buildMissionPrompt: jest.fn(),
}));

const mockUpdateSession = jest.fn();
jest.mock("@/lib/session-repository", () => ({
  updateSession: (...args: unknown[]) => mockUpdateSession(...args),
}));

jest.mock("@/lib/mission-cron-sync", () => ({
  enrichMissionCron: jest.fn((m: unknown) => m),
  pauseMissionCron: jest.fn(),
  syncMissionToCronJob: jest.fn(),
  deleteMissionCron: jest.fn(),
}));

jest.mock("@/lib/cron-repository", () => ({
  createCronJob: jest.fn(),
  pushJobToHermes: jest.fn(),
}));

jest.mock("@/lib/mission-category-repository", () => ({
  getCategory: jest.fn(),
}));

jest.mock("@/lib/local-dir-entry", () => ({
  normalizeLocalDirsInput: jest.fn((d) => d ?? []),
}));

jest.mock("@/lib/profiles-repository", () => ({
  listProfiles: jest.fn(() => []),
}));

beforeEach(() => {
  jest.clearAllMocks();
  cancelResolve = null;
});

describe("POST /api/missions cancel", () => {
  it("returns before background cancelMission completes", async () => {
    mockGetMission.mockReturnValue({
      id: "m-1",
      status: "dispatched",
      sessionId: "sess-1",
    });
    mockUpdateMission.mockReturnValue({
      id: "m-1",
      status: "failed",
      result: "Cancelled by user",
      sessionId: "sess-1",
    });

    const { POST } = require("@/app/api/missions/route") as {
      POST: (req: unknown) => Promise<{ json: () => Promise<unknown> }>;
    };
    const { NextRequest } = require("next/server") as {
      NextRequest: new (url: string, init?: RequestInit) => unknown;
    };

    const req = new NextRequest("http://localhost/api/missions", {
      method: "POST",
      body: JSON.stringify({ action: "cancel", id: "m-1" }),
    });

    const res = await POST(req);
    const body = (await res.json()) as {
      data?: {
        cancel?: { accepted: boolean; processKillPending: boolean };
        mission?: { id: string };
      };
    };

    expect(mockCancelMission).toHaveBeenCalledWith("m-1");
    expect(mockUpdateSession).toHaveBeenCalledWith(
      "sess-1",
      expect.objectContaining({ status: "failed", error: "Cancelled by user" }),
    );
    expect(body.data?.cancel?.accepted).toBe(true);
    expect(body.data?.cancel?.processKillPending).toBe(true);
    expect(body.data?.mission?.id).toBe("m-1");
    expect(cancelResolve).not.toBeNull();

    cancelResolve?.();
    await mockCancelMission.mock.results[0]?.value;
  });

  it("skips background process kill for completed missions", async () => {
    mockGetMission.mockReturnValue({
      id: "m-2",
      status: "successful",
    });
    mockUpdateMission.mockReturnValue({
      id: "m-2",
      status: "failed",
      result: "Cancelled by user",
    });

    const { POST } = require("@/app/api/missions/route") as {
      POST: (req: unknown) => Promise<{ json: () => Promise<unknown> }>;
    };
    const { NextRequest } = require("next/server") as {
      NextRequest: new (url: string, init?: RequestInit) => unknown;
    };

    const req = new NextRequest("http://localhost/api/missions", {
      method: "POST",
      body: JSON.stringify({ action: "cancel", missionId: "m-2" }),
    });

    const res = await POST(req);
    const body = (await res.json()) as {
      data?: { cancel?: { processKillPending: boolean } };
    };

    expect(mockCancelMission).not.toHaveBeenCalled();
    expect(body.data?.cancel?.processKillPending).toBe(false);
  });
});
