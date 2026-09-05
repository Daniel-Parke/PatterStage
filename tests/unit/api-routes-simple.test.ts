/** @jest-environment node */

const mockDb = {
  prepare: jest.fn((_sql: string) => ({
    get: jest.fn(),
    all: jest.fn(),
    run: jest.fn(),
  })),
  transaction: jest.fn((fn: () => void) => fn),
  pragma: jest.fn(),
  exec: jest.fn(),
  close: jest.fn(),
};

jest.mock("@/lib/db", () => ({
  getDb: jest.fn(() => mockDb),
  ensureDb: jest.fn(),
  now: jest.fn(() => "2026-05-15T00:00:00.000Z"),
  uuid: jest.fn(() => "test-uuid"),
}));

jest.mock("@/lib/sync", () => ({
  ensureSyncLayer: jest.fn(),
  getSyncScheduler: jest.fn(() => ({
    getLastCycleResult: jest.fn(() => null),
    getSourceNames: jest.fn(() => ["cron", "sessions", "config", "env", "logs", "processes", "memory"]),
    // /api/monitor now reads the per-source failure MESSAGE as well as the
    // status, so the stand-in has to answer the same interface the real
    // SyncScheduler does. See tests/unit/monitor-sync-source-errors.test.ts.
    getLastErrorBySource: jest.fn(() => ({})),
    isRunning: false,
  })),
  runFullSync: jest.fn(),
}));

jest.mock("@/lib/skills-repository", () => ({
  countSkills: jest.fn(() => 0),
}));

jest.mock("@/lib/system-repository", () => ({
  getSystemStat: jest.fn(() => null),
  getSystemStatNumber: jest.fn(() => 0),
  getMultipleStats: jest.fn(() => ({})),
  getSystemStatBoolean: jest.fn(() => false),
}));

jest.mock("@/modules/hermes/lib/agent-runtime", () => ({
  getActiveHermesPaths: jest.fn(() => ({
    root: "/tmp/test-hermes",
    env: "/tmp/test-hermes/.env",
    soul: "/tmp/test-hermes/SOUL.md",
    hermes: "/tmp/test-hermes/HERMES.md",
    agents: "/tmp/test-hermes/AGENTS.md",
    skills: "/tmp/test-hermes/skills",
    profiles: "/tmp/test-hermes/profiles",
    sessions: "/tmp/test-hermes/sessions",
    logs: "/tmp/test-hermes/logs",
    config: "/tmp/test-hermes/config.yaml",
    backups: "/tmp/test-hermes/backups",
    cronJobs: "/tmp/test-hermes/cron/jobs.json",
    memoryDb: "/tmp/test-hermes/memory_store.db",
  })),
  getActiveHermesHome: jest.fn(() => "/tmp/test-hermes"),
  getAgentLlmEndpoints: jest.fn(() => ({
    apiUrl: "http://127.0.0.1:9/v1/chat/completions",
    gatewayBase: "http://127.0.0.1:9",
  })),
}));

jest.mock("@/lib/paths", () => ({
  PS_DATA_DIR: "/tmp/ch-data",
  getPsDataDir: () => "/tmp/ch-data",
  // The real reader, not a stub: GET /api/sessions now consults PS_READ_ONLY
  // before it syncs (T-0095, D124), and a paths mock without readEnv turned
  // that read into a 500 that had nothing to do with sessions.
  readEnv: (...keys: string[]) => {
    for (const k of keys) {
      const v = process.env[k];
      if (v && String(v).trim()) return String(v).trim();
    }
    return undefined;
  },
  PATHS: {
    patterStageDb: "/tmp/ch-data/control-hub.db",
    missions: "/tmp/ch-data/missions",
    templates: "/tmp/ch-data/templates",
    stories: "/tmp/ch-data/stories",
    recroom: "/tmp/ch-data/recroom",
    workspaces: "/tmp/ch-data/workspaces",
    auditLog: "/tmp/ch-data/audit",
    psScripts: "/tmp/ch-data/scripts",
    psHardwareLogs: "/tmp/ch-data/logs",
  },
  getPsScriptsDir: () => "/tmp/ch-data/scripts",
  getPsHardwareLogDir: () => "/tmp/ch-data/logs",
}));

jest.mock("@/lib/api-logger", () => ({
  logApiError: jest.fn(),
  // The monitor route's catch block calls `serverErrorFromCatch(...)` and
  // expects a NextResponse to be returned. The mock must mirror that
  // contract or the test will see `undefined` and crash on `res.json()`.
  // Returning a minimal NextResponse-shaped object is enough for the
  // monitor test, which exercises the happy path (the catch block only
  // fires on actual errors). The error-path test in api-routes-complex
  // uses the real `serverErrorFromCatch` via a separate mock strategy.
  serverErrorFromCatch: jest.fn(
    (_route: string, _ctx: string, _err: unknown, _msg?: string) => ({
      status: 500,
      json: async () => ({ error: "mocked" }),
    }),
  ),
  safeJsonParse: jest.fn(),
  safeReadJsonFile: jest.fn(),
}));

jest.mock("@/lib/sessions/sessions-api-guard", () => ({
  sessionsRateLimitResponse: jest.fn(() => null),
}));

jest.mock("@/lib/sessions/session-repository", () => ({
  createSession: jest.fn(),
  updateSession: jest.fn(),
  getSession: jest.fn(),
  listSessions: jest.fn(() => ({ sessions: [], total: 0 })),
}));

import { NextRequest } from "next/server";
import { mockRequest } from "../helpers/api-test-helpers";

describe("GET /api/status", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns system status", async () => {
    const { getSystemStat } = await import("@/lib/system-repository");
    (getSystemStat as jest.Mock).mockImplementation((key: string) => {
      if (key === "config.soul_present") return "true";
      if (key === "config.present") return "true";
      if (key === "memory.db_size") return "1.2 MB";
      return null;
    });
    // THIS TEST IS WHY FINDING 3 LIVED FOR SO LONG. It used to mock
    // getSystemStatNumber to answer 12 and 42 for `skills.count` and
    // `sessions.total`, and assert the route echoed them. Nothing in the
    // product has ever WRITTEN either key, so the route reported 0 on every
    // real install while this suite proved the plumbing worked -- the
    // vacuous-sweep class T-0075 named. The counts are measured now (T-0081),
    // so the mocks moved to the repositories the route actually asks.
    const { countSkills } = await import("@/lib/skills-repository");
    (countSkills as jest.Mock).mockReturnValueOnce(12);
    const { listSessions } = await import("@/lib/sessions/session-repository");
    // Once, not permanently: jest.clearAllMocks() clears calls but keeps
    // implementations, and a sticky 42 leaked into the /api/sessions test
    // below.
    (listSessions as jest.Mock).mockReturnValueOnce({ sessions: [], total: 42 });

    const { GET } = await import("@/app/api/status/route");
    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.data).toBeDefined();
    expect(typeof data.data.soulFile).toBe("boolean");
    expect(typeof data.data.configFile).toBe("boolean");
    expect(data.data.skillsCount).toBe(12);
    expect(data.data.sessionsCount).toBe(42);
  });
});

describe("GET /api/sessions", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns empty list when no sessions", async () => {
    const request = new NextRequest("http://localhost/api/sessions");
    const { GET } = await import("@/app/api/sessions/route");
    const res = await GET(request);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.data.sessions).toEqual([]);
    expect(data.data.total).toBe(0);
  });

  it("lists session files from repository", async () => {
    const { listSessions } = await import("@/lib/sessions/session-repository");
    (listSessions as jest.Mock).mockReturnValueOnce({
      sessions: [
        {
          id: "session_abc",
          agentType: "hermes",
          source: "cli",
          missionId: null,
          profileName: null,
          modelId: null,
          provider: null,
          title: "session_abc",
          size: 1024,
          startedAt: "2026-01-01T00:00:00.000Z",
          endedAt: null,
          status: "active",
          exitCode: null,
          error: null,
        },
      ],
      total: 1,
    });

    const request = new NextRequest("http://localhost/api/sessions");
    const { GET } = await import("@/app/api/sessions/route");
    const res = await GET(request);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.data.sessions.length).toBe(1);
    expect(data.data.total).toBe(1);
  });
});

describe("GET /api/monitor", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns aggregated status", async () => {
    // The gateway platforms now come back through sync-repository, which
    // reads them off the mocked getDb below — the "SELECT platform, enabled"
    // branch supplies the same row the old getGatewayPlatforms mock did.
    // Mock DB reads
    const stmt = (rows: unknown[]) => ({
      get: jest.fn(() => rows[0]),
      all: jest.fn(() => rows),
      run: jest.fn(),
    });
    mockDb.prepare.mockImplementation((sql: string) => {
      if (sql.includes("SELECT platform, enabled")) {
        return stmt([{ platform: "discord", enabled: 1, bot_token_present: 1 }]);
      }
      if (sql.includes("SELECT source, message, timestamp")) {
        return stmt([
          { source: "gateway", message: "test error", timestamp: "2026-05-15T00:00:00" },
        ]);
      }
      return stmt([]);
    });

    const { GET } = await import("@/app/api/monitor/route");
    const res = await GET(mockRequest("http://127.0.0.1/api/test"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.data).toBeDefined();
    expect(data.data.memory).toBeDefined();
    expect(data.data.sync).toBeDefined();
    expect(data.data.sync.lastRun === null || typeof data.data.sync.lastRun === "string").toBe(true);
  });
});
