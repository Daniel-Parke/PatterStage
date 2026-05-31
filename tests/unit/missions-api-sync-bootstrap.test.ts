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
jest.mock("@/lib/cron-repository", () => ({ importHermesJobs: jest.fn() }));
jest.mock("@/lib/mission-repository", () => ({
  listMissions: jest.fn(() => []),
  getMission: jest.fn(),
}));
jest.mock("@/lib/mission-cron-sync", () => ({
  enrichMissionCron: jest.fn((m: unknown) => m),
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
