/** @jest-environment node */

jest.mock("next/server", () => ({
  NextRequest: class NextRequest {
    url: string;
    constructor(url: string) {
      this.url = url;
    }
  },
  NextResponse: {
    json: (data: unknown) => ({
      status: 200,
      json: async () => data,
    }),
  },
}));

jest.mock("@/lib/api-logger", () => ({ logApiError: jest.fn() }));

const mockScheduler = {
  isRunning: true,
  getSourceNames: () => ["missions", "cron"],
  getRunningSources: () => [],
  getLastErrorBySource: () => ({}),
  getLastCycleResult: () => null,
};

jest.mock("@/lib/sync", () => ({
  ensureSyncLayer: jest.fn(),
  getSyncScheduler: jest.fn(() => mockScheduler),
  runFullSync: jest.fn(async () => ({ allSuccessful: true, results: [] })),
}));

describe("GET /api/sync", () => {
  it("returns sync scheduler status", async () => {
    const { GET } = await import("@/app/api/sync/route");
    // next/server is mocked above, so build the request from the mocked class
    // rather than pulling in the shared helper (which would import the same mock).
    const { NextRequest } = await import("next/server");
    const res = await GET(new NextRequest("http://127.0.0.1/api/sync"));
    const body = (await res.json()) as { data: { running: boolean; sources: string[] } };
    expect(body.data.running).toBe(true);
    expect(body.data.sources).toContain("missions");
  });
});
