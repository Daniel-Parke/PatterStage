/** @jest-environment node */
// ═══════════════════════════════════════════════════════════════
// The sync failure REASON reaches the dashboard (T-0034, finding 2).
//
// The deferred finding: SyncScheduler already keeps the last error message per
// source, and /api/sync already serves it, but /api/monitor flattened every
// source to "ok" or "error". The dashboard therefore drew a bare red cross for
// a failure whose cause the server was holding in memory the whole time. The
// operator's only route to the text was a second endpoint nothing on the page
// called.
//
// This oracle pins the plumbing, not the pixels: the message the scheduler
// holds must arrive in the monitor payload, keyed by source, and a source that
// is fine must contribute no entry (an empty string is not "no error", and a
// panel that renders one draws an empty reason box).
// ═══════════════════════════════════════════════════════════════

jest.mock("next/server", () => ({
  NextRequest: class NextRequest {},
  NextResponse: {
    json: (data: unknown, init?: ResponseInit) => ({
      status: init?.status ?? 200,
      json: async () => data,
    }),
  },
}));

const mockScheduler = {
  isRunning: true,
  getSourceNames: () => ["missions", "cron", "process"],
  getRunningSources: () => [],
  getLastErrorBySource: () => ({ cron: "ENOENT: no such file or directory, open '/home/op/.hermes/crontab'" }),
  getLastCycleResult: () => ({
    completedAt: "2026-08-25T09:00:00Z",
    totalDurationMs: 12,
    allSuccessful: false,
    results: [
      { sourceName: "missions", success: true, syncedCount: 3, error: null, durationMs: 4 },
      { sourceName: "cron", success: false, syncedCount: 0, error: "ENOENT", durationMs: 8 },
    ],
  }),
};

jest.mock("@/lib/sync", () => ({
  ensureSyncLayer: jest.fn(),
  getSyncScheduler: jest.fn(() => mockScheduler),
}));
jest.mock("@/lib/sync/sync-repository", () => ({
  readGatewayPlatforms: jest.fn(() => []),
  readRecentErrorLogEntries: jest.fn(() => []),
}));
jest.mock("@/lib/system-repository", () => ({
  getSystemStat: jest.fn(() => null),
  getSystemStatNumber: jest.fn(() => 0),
}));
jest.mock("@/lib/sessions/session-repository", () => ({
  listSessions: jest.fn(() => ({ sessions: [], total: 0 })),
}));
jest.mock("@/lib/api-logger", () => ({
  logApiError: jest.fn(),
  serverErrorFromCatch: jest.fn(() => ({ status: 500, json: async () => ({ error: "boom" }) })),
}));
jest.mock("@/lib/frameworks", () => ({
  getActiveFramework: jest.fn(() => {
    throw new Error("no framework in this test");
  }),
}));
jest.mock("@/lib/orchestration/scheduler/health", () => ({
  readSchedulerHealth: jest.fn(() => ({ alive: true })),
}));

type MonitorBody = {
  data: {
    sync: {
      allSuccessful: boolean;
      sourceStatuses: Record<string, string>;
      sourceErrors: Record<string, string>;
    };
  };
};

async function getMonitor(): Promise<MonitorBody> {
  const { GET } = await import("@/app/api/monitor/route");
  const { NextRequest } = await import("next/server");
  const res = await GET(new NextRequest("http://127.0.0.1/api/monitor") as never);
  return (await res.json()) as MonitorBody;
}

describe("GET /api/monitor — the sync failure carries its reason", () => {
  it("serves the message the scheduler kept, keyed by source", async () => {
    const body = await getMonitor();
    expect(body.data.sync.sourceStatuses.cron).toBe("error");
    expect(body.data.sync.sourceErrors.cron).toContain("no such file or directory");
  });

  it("says nothing about a source that is fine", async () => {
    const body = await getMonitor();
    // Not `""`. A panel that renders every key draws an empty reason for every
    // healthy source, which is how a fix for a silent failure becomes noise.
    expect(body.data.sync.sourceErrors).not.toHaveProperty("missions");
    expect(body.data.sync.sourceErrors).not.toHaveProperty("process");
  });

  it("still reports the flattened status the dashboard already drew", async () => {
    const body = await getMonitor();
    expect(body.data.sync.allSuccessful).toBe(false);
    expect(body.data.sync.sourceStatuses.missions).toBe("ok");
    expect(body.data.sync.sourceStatuses.process).toBe("pending");
  });
});
