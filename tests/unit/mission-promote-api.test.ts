/* eslint-disable @typescript-eslint/no-require-imports */
/** @jest-environment node */

jest.mock("next/server", () => {
  // NextResponse as a real class so `bodyResult instanceof NextResponse`
  // (used by parseJsonBody's callsite) works. See session-37 findings.
  const responses: Array<{ data: unknown; init?: ResponseInit }> = [];
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
    NextRequest: class NextRequest {},
    NextResponse,
    __responses: responses,
  };
});

jest.mock("@/lib/api-logger", () => ({ logApiError: jest.fn() }));
jest.mock("@/lib/api-auth", () => ({ requireAuth: jest.fn(() => null), isReadOnly: jest.fn(() => false) }));
jest.mock("@/lib/audit-log", () => ({ appendAuditLine: jest.fn() }));
jest.mock("@/lib/missions/mission-category-repository", () => ({ getCategory: jest.fn() }));
jest.mock("@/lib/sync", () => ({ ensureSyncLayer: jest.fn() }));

const mockPromoteMission = jest.fn();

jest.mock("@/lib/missions/mission-promote-handler", () => ({
  promoteMission: (...args: unknown[]) => mockPromoteMission(...args),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

async function postPromote(dispatchMode: string) {
  const route = require("@/app/api/missions/route") as {
    POST: (req: import("next/server").NextRequest) => Promise<{ status: number; json: () => Promise<unknown> }>;
  };
  const req = {
    json: async () => ({
      action: "promote",
      missionId: "m_draft1",
      dispatchMode,
      instruction: "Updated task",
      name: "Renamed",
    }),
  } as unknown as import("next/server").NextRequest;
  return route.POST(req);
}

describe("POST /api/missions — promote action", () => {
  it("delegates draft → now to promoteMission", async () => {
    mockPromoteMission.mockResolvedValue({
      ok: true,
      mission: { id: "m_draft1", status: "dispatched" },
    });

    const res = await postPromote("now");
    expect(res.status).toBe(200);
    expect(mockPromoteMission).toHaveBeenCalledWith(
      expect.objectContaining({
        missionId: "m_draft1",
        dispatchMode: "now",
        name: "Renamed",
      }),
    );
  });

  it("returns promote errors with status from handler", async () => {
    mockPromoteMission.mockResolvedValue({
      ok: false,
      status: 400,
      error: "Mission cannot be promoted in its current state",
    });

    const res = await postPromote("queue");
    expect(res.status).toBe(400);
  });

  it("requires dispatchMode", async () => {
    const route = require("@/app/api/missions/route") as {
      POST: (req: import("next/server").NextRequest) => Promise<{ status: number }>;
    };
    const req = {
      json: async () => ({
        action: "promote",
        missionId: "m_draft1",
      }),
    } as unknown as import("next/server").NextRequest;
    const res = await route.POST(req);
    expect(res.status).toBe(400);
    expect(mockPromoteMission).not.toHaveBeenCalled();
  });
});
