/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports */

jest.mock("next/server", () => require("../helpers/mocks").nextServerMock());

jest.mock("@/lib/api/api-logger", () => ({ logApiError: jest.fn() }));
jest.mock("@/lib/api/api-auth", () => ({
  isReadOnly: jest.fn(() => false),
}));
jest.mock("@/lib/api/audit-log", () => ({ appendAuditLine: jest.fn() }));
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
