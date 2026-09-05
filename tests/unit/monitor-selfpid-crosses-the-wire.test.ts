/** @jest-environment node */

// T-0071 · F10 — selfPid has to survive the trip, and no type can promise it.
//
// The scheduler pill warns "this process (pid N) will not dispatch" only when
// `selfPid` and `ownerPid` disagree (dashboard/scheduler-pill.ts). That is the
// one signal an operator gets when a second PatterStage process is running and
// theirs is the one that will never fire a schedule.
//
// `readSchedulerHealth` returns selfPid, `SchedulerHealth` declares it, and the
// route spreads the object — every link is annotated and correct. None of that
// survives JSON: whatever fetches /api/monitor parses the response as `any`, so
// a field silently stopping at the boundary is invisible to the compiler and to
// every existing test, which mocks the health module and asserts on the mock.
//
// That is T-0068's defect exactly — a declared type that was a lie the compiler
// was structurally unable to detect, because the only place the shape is
// asserted is an unvalidated JSON boundary. The fence is a runtime assertion on
// the payload, so this file uses the REAL health module.
//
// THIS FILE WAS GREEN THE DAY IT WAS WRITTEN, and that is stated rather than
// buried. selfPid does cross the wire today; the reporter flagged F10 with
// explicit uncertainty and they were right to. It is a FENCE, not a fix — the
// only thing standing between the pill's warning and a silent regression, since
// no type and no other test can see that boundary. An oracle that starts green
// earns its place only when it can go red, so the mutation record for T-0071
// includes deleting the field from the payload.

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
  isRunning: false,
  getSourceNames: () => [],
  getRunningSources: () => [],
  getLastErrorBySource: () => ({}),
  getLastCycleResult: () => null,
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
jest.mock("@/lib/frameworks", () => ({ getActiveFramework: jest.fn(() => null) }));
// NOT mocked, deliberately: @/lib/orchestration/scheduler/health. Mocking it is
// what makes every other monitor test unable to see this.

type Body = { data: { scheduler: { selfPid?: unknown; ownerPid?: unknown; stale?: unknown } } };

async function monitor(): Promise<Body> {
  const { GET } = await import("@/app/api/monitor/route");
  const res = await GET({} as never);
  return (await res.json()) as Body;
}

describe("GET /api/monitor carries the fields the pill reads", () => {
  it("selfPid reaches the wire as a number", async () => {
    const body = await monitor();
    expect(typeof body.data.scheduler.selfPid).toBe("number");
    expect(body.data.scheduler.selfPid).toBe(process.pid);
  });

  it("so do the two fields it is compared against", async () => {
    // selfPid alone proves nothing: the warning fires on a COMPARISON, so
    // ownerPid dropping out silences it just as completely.
    const body = await monitor();
    expect(body.data.scheduler).toHaveProperty("ownerPid");
    expect(body.data.scheduler).toHaveProperty("stale");
  });
});
