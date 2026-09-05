/** @jest-environment node */
/**
 * B1 (T-0095), D124: three GET handlers write.
 *
 * `PS_READ_ONLY` is enforced by method in src/proxy.ts, and docs/reference/api.md said
 * that made it apply "to every route uniformly: there is nothing a route can
 * forget to call". Three reads disagreed. GET /api/stats appends a progression
 * snapshot, GET /api/agent/profiles/[id]/toolsets persists normalised JSON, and
 * GET /api/sessions syncs state.db into the sessions table. Each is a real write
 * that the mode is supposed to stop, and each happened on every poll.
 *
 * The read keeps answering. The bookkeeping beside it is skipped under the mode,
 * with the linter's own pragma naming why a GET may mention the guard at all.
 */
const mockCapture = jest.fn();
const mockGetDashboardStats = jest.fn(() => ({ agents: [], achievements: [] }));
jest.mock("@/lib/stats/stats-repository", () => ({
  getDashboardStats: () => mockGetDashboardStats(),
}));
jest.mock("@/lib/stats/agent-progression", () => ({
  captureAgentProgressionSnapshots: (input: unknown) => mockCapture(input),
}));

const mockHydrate = jest.fn((..._a: unknown[]) => ({
  toolsets: { cli: ["hermes-cli"] },
  source: "database" as const,
  platformToolsetsJson: '{"cli":["hermes-cli"]}',
}));
jest.mock("@/modules/hermes/lib/profiles-repository", () => ({
  hydratePlatformToolsetsForSlug: (...args: unknown[]) => mockHydrate(...args),
  getProfile: jest.fn(() => ({ slug: "qa" })),
  updateProfileContent: jest.fn(),
}));
jest.mock("@/lib/agent-root-repository", () => ({ updateAgentRoot: jest.fn() }));
jest.mock("@/modules/hermes/lib/profile-push", () => ({
  pushProfileToHermes: jest.fn(),
  pushRootToHermes: jest.fn(),
}));

const mockListSessions = jest.fn();
jest.mock("@/lib/sessions/session-repository", () => ({
  listSessions: (...a: unknown[]) => mockListSessions(...a),
  getSession: jest.fn(),
  createSession: jest.fn(),
  updateSession: jest.fn(),
}));
const mockTriggerSyncOnce = jest.fn();
jest.mock("@/lib/sessions/sessions-api-helpers", () => ({
  ...jest.requireActual("@/lib/sessions/sessions-api-helpers"),
  triggerSyncOnce: (...a: unknown[]) => mockTriggerSyncOnce(...a),
}));
jest.mock("@/lib/sync", () => ({ ensureSyncLayer: jest.fn(), syncSessionsNow: jest.fn() }));
jest.mock("@/lib/api-logger", () => ({ logApiError: jest.fn(), serverErrorFromCatch: jest.fn() }));

import { NextRequest } from "next/server";

const savedEnv = { ...process.env };
beforeEach(() => {
  jest.clearAllMocks();
  mockListSessions.mockReturnValue({ sessions: [], total: 0, totals: {} });
  delete process.env.PS_READ_ONLY;
  delete process.env.CH_READ_ONLY;
});
afterEach(() => {
  process.env = { ...savedEnv };
});

let client = 0;
const sessionsReq = () =>
  new NextRequest("http://localhost:4242/api/sessions", {
    headers: { "x-forwarded-for": `10.9.0.${++client}` },
  });

describe("GET /api/stats", () => {
  it("answers under read-only without capturing a progression snapshot", async () => {
    process.env.PS_READ_ONLY = "1";
    const { GET } = await import("@/app/api/stats/route");
    const res = await GET();
    expect(res.status).toBe(200);
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it("GREEN CONTROL: captures when writes are allowed", async () => {
    const { GET } = await import("@/app/api/stats/route");
    await GET();
    expect(mockCapture).toHaveBeenCalledTimes(1);
  });
});

describe("GET /api/agent/profiles/[id]/toolsets", () => {
  it("hydrates without persisting under read-only", async () => {
    process.env.PS_READ_ONLY = "1";
    const { GET } = await import("@/app/api/agent/profiles/[id]/toolsets/route");
    const res = await GET(new NextRequest("http://localhost/api/agent/profiles/qa/toolsets"), {
      params: Promise.resolve({ id: "qa" }),
    });
    expect(res.status).toBe(200);
    expect(mockHydrate).toHaveBeenCalledWith("qa", { persist: false });
  });

  it("GREEN CONTROL: persists the normalised JSON when writes are allowed", async () => {
    const { GET } = await import("@/app/api/agent/profiles/[id]/toolsets/route");
    await GET(new NextRequest("http://localhost/api/agent/profiles/qa/toolsets"), {
      params: Promise.resolve({ id: "qa" }),
    });
    expect(mockHydrate).toHaveBeenCalledWith("qa", { persist: true });
  });
});

describe("GET /api/sessions", () => {
  it("lists without syncing state.db under read-only", async () => {
    process.env.PS_READ_ONLY = "1";
    const { GET } = await import("@/app/api/sessions/route");
    const res = await GET(sessionsReq());
    expect(res.status).toBe(200);
    expect(mockTriggerSyncOnce).not.toHaveBeenCalled();
    expect(mockListSessions).toHaveBeenCalledWith(expect.objectContaining({ syncIfActive: false }));
  });

  it("GREEN CONTROL: syncs when writes are allowed", async () => {
    const { GET } = await import("@/app/api/sessions/route");
    await GET(sessionsReq());
    expect(mockTriggerSyncOnce).toHaveBeenCalledTimes(1);
    expect(mockListSessions).toHaveBeenCalledWith(expect.objectContaining({ syncIfActive: true }));
  });
});
