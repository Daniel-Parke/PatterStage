/** @jest-environment node */
// ═══════════════════════════════════════════════════════════════
// B11 oracle, the transcript payload (T-0105, contract §2 §11).
//
// Written before the product code moved. What each case pins:
//
//   D40  The state.db branch of GET /api/sessions/[id] maps EVERY message
//        row with no cap at all — the 64 MiB guard is only applied on the
//        legacy-file branch, which a state.db install never reaches. A long
//        agent session therefore ships an unbounded JSON payload. The read
//        takes a limit, answers the NEWEST N in reading order, and says so
//        with a `truncated` flag the page can render.
//   D30  status, exitCode and error exist on the record and are rendered
//        nowhere. The transcript payload has to carry them before the page
//        can say a session failed.
//   D36  The transcript's Refresh button is gated on a note that only
//        exists when there are no messages; `status` is what lets a running
//        session with a transcript be recognised as running.
//
// The agent's state.db is faked at the better-sqlite3 boundary, and the fake
// honours ORDER BY and LIMIT so an implementation that pushes the cap into
// SQL is measured the same way as one that slices in JS.
// ═══════════════════════════════════════════════════════════════

const prepared: string[] = [];

const mockStateDbHandle = {
  prepare: jest.fn(),
  close: jest.fn(),
};

function FakeDatabase() {
  return mockStateDbHandle;
}

jest.mock("better-sqlite3", () => ({ __esModule: true, default: FakeDatabase }));

jest.mock("fs", () => {
  const actual = jest.requireActual("fs");
  return {
    ...actual,
    existsSync: jest.fn((p: string) => String(p).includes("state.db")),
    readFileSync: jest.fn(() => {
      throw new Error("the legacy file branch must not be reached");
    }),
    statSync: jest.fn(() => {
      throw new Error("the legacy file branch must not be reached");
    }),
  };
});

jest.mock("@/lib/runtime/workspace", () => ({
  getAgentWorkspace: () => ({
    root: "/tmp/agent",
    logs: "/tmp/agent/logs",
    config: "/tmp/agent/config.yaml",
    env: "/tmp/agent/.env",
    backups: "/tmp/agent/backups",
    sessions: "/tmp/agent/sessions",
    memoryDb: "/tmp/agent/memory_store.db",
  }),
}));

jest.mock("@/lib/paths", () => ({
  PATHS: { missions: "/tmp/ps-data/missions" },
  getPsDataDir: () => "/tmp/ps-data",
}));

const mockGetSession = jest.fn();
jest.mock("@/lib/sessions/session-repository", () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
  estimateSessionSize: () => 0,
  listSessions: () => ({ sessions: [], total: 0 }),
  createSession: jest.fn(),
  updateSession: jest.fn(),
}));

jest.mock("@/lib/sessions/session-mission-links", () => ({
  lookupMissionIdForCronSession: () => null,
}));

/** The cap the route must ask for. Three, so five rows is over it. */
const MAX_MESSAGES = 3;

jest.mock("@/lib/sessions/sessions-api-guard", () => ({
  getMaxSessionFileBytes: () => 64 * 1024 * 1024,
  getMaxSessionMessages: () => MAX_MESSAGES,
  sessionsRateLimitResponse: () => null,
}));

jest.mock("@/lib/api-logger", () => ({
  logApiError: jest.fn(),
  serverErrorFromCatch: jest.fn(),
}));

import { NextRequest } from "next/server";

import { readAgentSessionDetail } from "@/lib/runtime/state-db";

// ── post-B11 signature shim ─────────────────────────────────

interface B11Detail {
  session: { id: string };
  messages: Array<{ content: string | null; timestamp: number }>;
  /** True when the store held more messages than the caller asked for. */
  truncated: boolean;
}

const readDetail = readAgentSessionDetail as unknown as (
  id: string,
  messageLimit?: number,
) => B11Detail | null;

// ── The fake state.db ───────────────────────────────────────

const SESSION_ID = "sess-b11";

const SESSION_ROW = {
  id: SESSION_ID,
  source: "cli",
  model: "sonnet-4",
  title: "A long conversation",
  started_at: 1780617950,
  ended_at: 1780618950,
  end_reason: "done",
  message_count: 5,
  api_call_count: 5,
};

/** Five messages, oldest first, as the table stores them. */
const MESSAGE_ROWS = [1, 2, 3, 4, 5].map((n) => ({
  role: n % 2 === 1 ? "user" : "assistant",
  content: `message ${n}`,
  tool_name: null,
  tool_calls: null,
  tool_call_id: null,
  finish_reason: null,
  reasoning: null,
  timestamp: 1780617950 + n,
}));

function installFakeDb(sessionRow: Record<string, unknown> | null = SESSION_ROW): void {
  prepared.length = 0;
  mockStateDbHandle.prepare = jest.fn((sql: string) => {
    prepared.push(sql);
    if (sql.includes("FROM sessions WHERE id =")) {
      return { get: () => sessionRow ?? undefined, all: () => [], run: jest.fn() };
    }
    if (sql.includes("FROM messages WHERE session_id =")) {
      return {
        get: () => undefined,
        all: (...args: unknown[]) => {
          let rows = [...MESSAGE_ROWS];
          // The fake honours the statement it is given, so a cap pushed into
          // SQL is exercised exactly as SQLite would exercise it.
          if (/ORDER BY[\s\S]*DESC/i.test(sql)) rows.reverse();
          const bound = args.filter((a) => typeof a === "number") as number[];
          if (/LIMIT/i.test(sql) && bound.length > 0) rows = rows.slice(0, bound[0]);
          return rows;
        },
        run: jest.fn(),
      };
    }
    return { get: () => undefined, all: () => [], run: jest.fn() };
  });
}

function messagesSql(): string | undefined {
  return prepared.find((sql) => sql.includes("FROM messages WHERE session_id ="));
}

async function callRoute(id = SESSION_ID): Promise<{ status: number; body: Record<string, unknown> }> {
  const { GET } = await import("@/app/api/sessions/[id]/route");
  const res = await GET(new NextRequest(`http://localhost/api/sessions/${id}`), {
    params: Promise.resolve({ id }),
  });
  const json = (await res.json()) as { data: Record<string, unknown> };
  return { status: res.status, body: json.data };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetSession.mockReturnValue(null);
  installFakeDb();
});

// ═══════════════════════════════════════════════════════════════
// D40 — the read is bounded
// ═══════════════════════════════════════════════════════════════

describe("reading one session's messages takes a bound", () => {
  it("answers the newest N, in reading order, and says it truncated", () => {
    const detail = readDetail(SESSION_ID, 2)!;

    expect(detail.messages.map((m) => m.content)).toEqual(["message 4", "message 5"]);
    expect(detail.truncated).toBe(true);
  });

  it("bounds the statement rather than the array it already paid for", () => {
    readDetail(SESSION_ID, 2);

    expect(messagesSql()).toMatch(/LIMIT/i);
  });

  it("says nothing was dropped when the session fits inside the bound", () => {
    const detail = readDetail(SESSION_ID, 50)!;

    expect(detail.messages).toHaveLength(5);
    expect(detail.truncated).toBe(false);
  });

  it("GUARD: an unbounded read still returns the whole transcript, oldest first", () => {
    const detail = readDetail(SESSION_ID)!;

    expect(detail.messages.map((m) => m.content)).toEqual([
      "message 1",
      "message 2",
      "message 3",
      "message 4",
      "message 5",
    ]);
  });

  it("GUARD: a session the store does not hold is still null", () => {
    installFakeDb(null);

    expect(readDetail("nope", 2)).toBeNull();
  });
});

describe("GET /api/sessions/[id] ships a bounded payload", () => {
  it("sends at most the configured number of messages", async () => {
    const { body } = await callRoute();

    expect(body.messages).toHaveLength(MAX_MESSAGES);
  });

  it("flags the payload as truncated so the page can say so", async () => {
    const { body } = await callRoute();

    expect(body.truncated).toBe(true);
  });

  it("GREEN CONTROL: it is still the transcript of the session that was asked for", async () => {
    const { status, body } = await callRoute();

    expect(status).toBe(200);
    expect(body.id).toBe(SESSION_ID);
    expect(body.title).toBe("A long conversation");
  });
});

// ═══════════════════════════════════════════════════════════════
// D30 / D36 — the payload carries the outcome
// ═══════════════════════════════════════════════════════════════

describe("the transcript payload carries how the session ended", () => {
  it("reports a failure with its exit code and its error", async () => {
    mockGetSession.mockReturnValue({
      id: SESSION_ID,
      source: "mission",
      status: "failed",
      exitCode: 137,
      error: "Killed by the OOM killer",
      title: "A long conversation",
      modelId: "sonnet-4",
      startedAt: "2026-09-05T10:00:00.000Z",
      missionId: null,
      size: 0,
    });

    const { body } = await callRoute();

    expect({ status: body.status, exitCode: body.exitCode, error: body.error }).toEqual({
      status: "failed",
      exitCode: 137,
      error: "Killed by the OOM killer",
    });
  });

  it("reports a session that has not ended as active, so Refresh can appear", async () => {
    installFakeDb({ ...SESSION_ROW, ended_at: null });

    const { body } = await callRoute();

    expect(body.status).toBe("active");
  });

  it("reports a finished session as completed", async () => {
    const { body } = await callRoute();

    expect(body.status).toBe("completed");
  });
});
