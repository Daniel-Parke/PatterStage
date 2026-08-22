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
jest.mock("@/lib/missions/mission-repository", () => ({
  listMissions: jest.fn(() => []),
  getMission: jest.fn(),
}));

const mockEnsureSyncLayer = jest.fn();

jest.mock("@/lib/sync", () => ({
  ensureSyncLayer: (...args: unknown[]) => mockEnsureSyncLayer(...args),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe("GET /api/missions — sync bootstrap", () => {
  it("calls ensureSyncLayer so MissionQueueSync runs on missions-only pages", async () => {
    const route = require("@/app/api/missions/route") as {
      GET: (req: Request) => Promise<{ status: number }>;
    };
    const req = { url: "http://localhost/api/missions" } as Request;
    await route.GET(req);
    expect(mockEnsureSyncLayer).toHaveBeenCalled();
  });
});

describe("POST /api/missions — sync bootstrap", () => {
  it("calls ensureSyncLayer before handling actions", async () => {
    const route = require("@/app/api/missions/route") as {
      POST: (req: import("next/server").NextRequest) => Promise<{ status: number }>;
    };
    const req = {
      json: async () => ({ action: "unknown" }),
    } as unknown as import("next/server").NextRequest;
    await route.POST(req);
    expect(mockEnsureSyncLayer).toHaveBeenCalled();
  });
});
