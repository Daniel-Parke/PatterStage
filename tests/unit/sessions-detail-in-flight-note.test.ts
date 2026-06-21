/**
 * sessions-detail-in-flight-note — unit tests for the in-flight empty-state
 * note added to GET /api/sessions/[id] Step 1.
 *
 * When a session exists in Hermes state.db (Step 1 succeeds) but the
 * messages table is empty AND ended_at IS NULL, the session is in flight —
 * the agent is actively running but hasn't flushed any messages yet. The
 * user reported this case as "No messages in this session", which is
 * misleading because the session is healthy and live. The fix adds a
 * `note` field whose text the frontend's isSessionStillRunning() helper
 * pattern-matches to decide whether to render the refresh CTA.
 *
 * Three cases under test:
 *   1. In-flight + empty messages  → note is present
 *   2. In-flight + has messages     → no note (messages themselves are the signal)
 *   3. Ended + empty messages      → no note (session completed empty — different UI)
 *
 * The `existsSync` mock returns true only for the state.db path so Step 1
 * fires; all other fs lookups return false so Step 2 (file-based) doesn't
 * interfere.
 */

/** @jest-environment node */

// Mock better-sqlite3 to return a controllable handle. The real module is
// not loadable in tests because it requires the native addon. We override
// the global mock in jest.setup.ts with a function that returns our
// state.db fake. The route does `new Database(stateDbPath, { readonly: true })`,
// so the default export must be constructable.
const mockStateDbHandle = {
  prepare: jest.fn(),
  close: jest.fn(),
};
function FakeDatabase() {
  return mockStateDbHandle;
}

jest.mock("better-sqlite3", () => ({
  __esModule: true,
  default: FakeDatabase,
}));

// Mock fs so existsSync only returns true for the state.db path used by
// Step 1. Step 2 (file-based sessions) and the no-output-yet sentinel
// branch need to NOT fire — we want to isolate Step 1.
jest.mock("fs", () => {
  const actual = jest.requireActual("fs");
  return {
    ...actual,
    existsSync: jest.fn((p: string) => p.includes("state.db")),
    readFileSync: jest.fn(() => {
      throw new Error("readFileSync should not be called in Step 1 tests");
    }),
    statSync: jest.fn(() => {
      throw new Error("statSync should not be called in Step 1 tests");
    }),
  };
});

jest.mock("@/lib/session-repository", () => ({
  createSession: jest.fn(),
  updateSession: jest.fn(),
  getSession: jest.fn(),
  listSessions: jest.fn(() => ({ sessions: [], total: 0 })),
  estimateSessionSize: jest.fn(() => 0),
}));

// lookupMissionIdForCronSession moved to session-sync (the route imports it
// from there); the in-flight-note tests only need it to no-op.
jest.mock("@/lib/session-sync", () => ({
  lookupMissionIdForCronSession: jest.fn(() => null),
}));

jest.mock("@/lib/sessions-api-guard", () => ({
  getMaxSessionFileBytes: jest.fn(() => 50 * 1024 * 1024),
  sessionsRateLimitResponse: jest.fn(() => null),
}));

jest.mock("@/lib/api-auth", () => ({
  requireAuth: jest.fn(() => null),
}));

jest.mock("@/lib/api-logger", () => ({
  logApiError: jest.fn(),
  serverErrorFromCatch: jest.fn(),
}));

jest.mock("@/lib/hermes-agent-runtime", () => ({
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
  PATHS: {
    patterStageDb: "/tmp/ch-data/control-hub.db",
    missions: "/tmp/ch-data/missions",
    templates: "/tmp/ch-data/templates",
    stories: "/tmp/ch-data/stories",
    recroom: "/tmp/ch-data/recroom",
    workspaces: "/tmp/ch-data/workspaces",
    auditLog: "/tmp/ch-data/audit",
    chScripts: "/tmp/ch-data/scripts",
    chHardwareLogs: "/tmp/ch-data/logs",
  },
  getPsScriptsDir: () => "/tmp/ch-data/scripts",
  getPsHardwareLogDir: () => "/tmp/ch-data/logs",
}));

import { NextRequest } from "next/server";

function makePrepareScript(
  sessionRow: Record<string, unknown> | undefined,
  messageRows: Array<Record<string, unknown>> = [],
) {
  // Build a per-SQL prepare() function so the test can verify which
  // queries the route ran. Returns the right shape for the .get() call
  // (session lookup) and the .all() call (messages list).
  return jest.fn((sql: string) => {
    if (sql.includes("FROM sessions WHERE id =")) {
      return {
        get: jest.fn((..._args: unknown[]) => sessionRow),
        all: jest.fn(() => []),
        run: jest.fn(),
      };
    }
    if (sql.includes("FROM messages WHERE session_id =")) {
      return {
        get: jest.fn(),
        all: jest.fn(() => messageRows),
        run: jest.fn(),
      };
    }
    return {
      get: jest.fn(() => undefined),
      all: jest.fn(() => []),
      run: jest.fn(),
    };
  });
}

describe("GET /api/sessions/[id] — in-flight empty-state note", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns a 'still running' note when session is in flight and has no messages", async () => {
    // In-flight cron session: ended_at IS NULL, message_count=0, no messages flushed yet
    const sessionRow = {
      id: "cron_job123_20260605_010549",
      source: "cron",
      model: "MiniMax-M3",
      title: null,
      started_at: 1780617950.113,
      ended_at: null,
      end_reason: null,
      message_count: 0,
      api_call_count: 60,
    };
    mockStateDbHandle.prepare = makePrepareScript(sessionRow, []);

    const { GET } = await import("@/app/api/sessions/[id]/route");
    const request = new NextRequest(
      "http://localhost/api/sessions/cron_job123_20260605_010549",
    );
    const res = await GET(request, {
      params: Promise.resolve({ id: "cron_job123_20260605_010549" }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.data.messages).toEqual([]);
    expect(data.data.messageCount).toBe(0);
    expect(data.data.source).toBe("cron");
    // The fix: a `note` field is present and contains the "still running"
    // vocabulary that isSessionStillRunning() pattern-matches
    expect(data.data.note).toBeDefined();
    expect(data.data.note).toMatch(/still running/i);
  });

  it("uses cron-specific wording for in-flight cron sessions with no messages", async () => {
    const sessionRow = {
      id: "cron_job123_20260605_010549",
      source: "cron",
      model: "MiniMax-M3",
      title: null,
      started_at: 1780617950.113,
      ended_at: null,
      end_reason: null,
      message_count: 0,
      api_call_count: 60,
    };
    mockStateDbHandle.prepare = makePrepareScript(sessionRow, []);

    const { GET } = await import("@/app/api/sessions/[id]/route");
    const request = new NextRequest(
      "http://localhost/api/sessions/cron_job123_20260605_010549",
    );
    const res = await GET(request, {
      params: Promise.resolve({ id: "cron_job123_20260605_010549" }),
    });
    const data = await res.json();

    // Cron-specific copy: "This cron-spawned session is still running."
    expect(data.data.note).toMatch(/cron-spawned session is still running/i);
  });

  it("uses generic wording for in-flight non-cron sessions with no messages", async () => {
    const sessionRow = {
      id: "20260605_004029_eb3ab8",
      source: "cli",
      model: "MiniMax-M3",
      title: "Investigation",
      started_at: 1780617950.113,
      ended_at: null,
      end_reason: null,
      message_count: 0,
      api_call_count: 0,
    };
    mockStateDbHandle.prepare = makePrepareScript(sessionRow, []);

    const { GET } = await import("@/app/api/sessions/[id]/route");
    const request = new NextRequest(
      "http://localhost/api/sessions/20260605_004029_eb3ab8",
    );
    const res = await GET(request, {
      params: Promise.resolve({ id: "20260605_004029_eb3ab8" }),
    });
    const data = await res.json();

    // Generic copy: "This session is in progress." (no "cron-spawned")
    expect(data.data.note).toMatch(/session is in progress/i);
    expect(data.data.note).not.toMatch(/cron-spawned/i);
  });

  it("omits the note when session is in flight but already has flushed messages", async () => {
    // In-flight but with at least one committed message — messages are
    // the signal, no note needed. The frontend renders the message list
    // (potentially with a "live" badge separately) instead of the empty
    // state with a refresh CTA.
    const sessionRow = {
      id: "20260605_004029_eb3ab8",
      source: "cli",
      model: "MiniMax-M3",
      title: "Investigation",
      started_at: 1780617950.113,
      ended_at: null,
      end_reason: null,
      message_count: 5,
      api_call_count: 10,
    };
    const messageRows = [
      {
        role: "user",
        content: "first message",
        tool_name: null,
        tool_calls: null,
        tool_call_id: null,
        finish_reason: null,
        reasoning: null,
        timestamp: 1780617955.0,
      },
    ];
    mockStateDbHandle.prepare = makePrepareScript(sessionRow, messageRows);

    const { GET } = await import("@/app/api/sessions/[id]/route");
    const request = new NextRequest(
      "http://localhost/api/sessions/20260605_004029_eb3ab8",
    );
    const res = await GET(request, {
      params: Promise.resolve({ id: "20260605_004029_eb3ab8" }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.data.messages.length).toBe(1);
    expect(data.data.messageCount).toBe(1);
    // The note is omitted — messages are the signal
    expect(data.data.note).toBeUndefined();
  });

  it("omits the note when session has ended (even with no messages)", async () => {
    // Session completed with no messages — different UX from "in flight
    // empty". The frontend should render the normal "No messages" state
    // because the session is genuinely done. A live-refresh CTA would
    // be wrong here (the agent isn't running anymore).
    const sessionRow = {
      id: "20260604_150000_aaaaaa",
      source: "cli",
      model: "MiniMax-M3",
      title: "Empty test session",
      started_at: 1780610000.0,
      ended_at: 1780613600.0, // ended 1h later
      end_reason: "stop",
      message_count: 0,
      api_call_count: 1,
    };
    mockStateDbHandle.prepare = makePrepareScript(sessionRow, []);

    const { GET } = await import("@/app/api/sessions/[id]/route");
    const request = new NextRequest(
      "http://localhost/api/sessions/20260604_150000_aaaaaa",
    );
    const res = await GET(request, {
      params: Promise.resolve({ id: "20260604_150000_aaaaaa" }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.data.messages).toEqual([]);
    // Ended sessions: no note (the generic empty-state message is correct)
    expect(data.data.note).toBeUndefined();
  });
});
