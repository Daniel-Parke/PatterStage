/* eslint-disable @typescript-eslint/no-require-imports */
/** @jest-environment node */

/**
 * Tests that POST /api/missions with dispatchMode="cron" creates a cron job
 * and links it to the mission, instead of dispatching a one-shot chat process.
 */

jest.mock("next/server", () => {
  const responses: Array<{ data: unknown; init?: ResponseInit }> = [];
  return {
    NextRequest: class NextRequest {
      url: string;
      method: string;
      headers: Headers;
      bodyUsed: boolean = false;
      private _body: string;
      constructor(url: string, init?: RequestInit) {
        this.url = url;
        this.method = init?.method ?? "GET";
        this.headers = new Headers(init?.headers as HeadersInit);
        this._body = typeof init?.body === "string" ? init.body : JSON.stringify(init?.body ?? {});
      }
      async json() { return JSON.parse(this._body); }
    },
    NextResponse: {
      json: (data: unknown, init?: ResponseInit) => {
        const entry = { data, init };
        responses.push(entry);
        const status = init?.status ?? 200;
        return {
          ok: status >= 200 && status < 300,
          status,
          json: () => Promise.resolve(data),
        };
      },
      __responses: responses,
    },
  };
});

const mockLogApiError = jest.fn();
jest.mock("@/lib/api-logger", () => ({ logApiError: (...args: unknown[]) => mockLogApiError(...args) }));

jest.mock("@/lib/api-auth", () => ({
  requireAuth: jest.fn(() => null),
  requireMcApiKey: jest.fn(() => null),
  requireNotReadOnly: jest.fn(() => null),
}));

jest.mock("@/lib/audit-log", () => ({
  appendAuditLine: jest.fn(),
}));

jest.mock("@/lib/backends", () => ({
  agentBackend: {
    dispatchMission: jest.fn(),
    listProfiles: jest.fn().mockResolvedValue([]),
  },
}));

// ── Mission repo mock ────────────────────────────────────────────

const mockCreateMission = jest.fn();
const mockGetMission = jest.fn();
const mockUpdateMission = jest.fn();
const mockListMissions = jest.fn();
const mockDeleteMission = jest.fn();
const mockBuildMissionPrompt = jest.fn();

jest.mock("@/lib/mission-repository", () => ({
  createMission: (...args: unknown[]) => mockCreateMission(...args),
  getMission: (...args: unknown[]) => mockGetMission(...args),
  updateMission: (...args: unknown[]) => mockUpdateMission(...args),
  listMissions: (...args: unknown[]) => mockListMissions(...args),
  deleteMission: (...args: unknown[]) => mockDeleteMission(...args),
  buildMissionPrompt: (...args: unknown[]) => mockBuildMissionPrompt(...args),
}));

jest.mock("@/lib/local-dir-entry", () => ({
  normalizeLocalDirsInput: jest.fn((d) => d ?? []),
}));

jest.mock("@/lib/session-repository", () => ({
  createSession: jest.fn(() => ({ id: "session_mock" })),
  updateSession: jest.fn(),
}));

// ── Cron repo mock ───────────────────────────────────────────────

const mockCreateCronJob = jest.fn();
const mockPushJobToHermes = jest.fn();

jest.mock("@/lib/cron-repository", () => ({
  createCronJob: (...args: unknown[]) => mockCreateCronJob(...args),
  pushJobToHermes: (...args: unknown[]) => mockPushJobToHermes(...args),
}));

// ── Base mission shape ───────────────────────────────────────────

function makeMission(overrides: Record<string, unknown> = {}) {
  return {
    id: "m-cron-test-001",
    name: "Test Recurring Mission",
    prompt: "Recurring task prompt",
    status: "queued",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    schedule: "every 5m",
    cronJobId: null,
    localDirs: [],
    references: [],
    skills: [],
    goals: [],
    ...overrides,
  };
}

// ── Route helper ─────────────────────────────────────────────────

async function postRoute(body: Record<string, unknown>) {
  // Clear module cache so each call gets fresh mocked modules
  jest.isolateModules(() => { /* no-op — modules already set up */ });
  // Dynamic import after mocks are in place
  const routeModule = require("@/app/api/missions/route") as { POST: (req: Request) => unknown };
  const req = {
    url: "http://localhost/api/missions",
    method: "POST",
    headers: new Headers({ "content-type": "application/json" }),
    body: JSON.stringify(body),
    json: async () => body,
  } as unknown as Request;
  return routeModule.POST(req) as unknown as { status: number; ok: boolean; json(): Promise<Record<string, unknown>> };
}

describe("POST /api/missions — cron dispatch (dispatchMode='cron')", () => {

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock returns
    mockBuildMissionPrompt.mockReturnValue("Built prompt for recurring task");
    mockCreateMission.mockImplementation((data: Record<string, unknown>) =>
      makeMission({
        name: data.name,
        prompt: data.prompt,
        schedule: data.schedule,
        cronJobId: data.cronJobId ?? null,
      })
    );
    mockGetMission.mockImplementation((id: string) => {
      if (id === "m-cron-test-001") return makeMission({ cronJobId: "cj-mock-001" });
      return null;
    });
    mockUpdateMission.mockImplementation((id: string, updates: Record<string, unknown>) => {
      const mission = makeMission();
      return { ...mission, ...updates, id };
    });

    // Cron job mocks
    mockCreateCronJob.mockReturnValue({ id: "cj-mock-001", name: "Test Recurring Mission" });
    mockPushJobToHermes.mockReturnValue({ ok: true, hermesJobId: "hermes-cj-001" });
  });

  it("creates a cron job when dispatchMode is 'cron' with a schedule", async () => {
    const res = await postRoute({
      action: "dispatch",
      name: "Test Recurring Mission",
      instruction: "Do the thing every 5 minutes",
      dispatchMode: "cron",
      schedule: "every 5m",
    });

    expect(res.status).toBe(201);
    expect(res.ok).toBe(true);

    // Must create a cron job
    expect(mockCreateCronJob).toHaveBeenCalledTimes(1);
    const cronInput = mockCreateCronJob.mock.calls[0][0];
    expect(cronInput.schedule).toBe("every 5m");
    expect(cronInput.repeat).toEqual({ times: null });
    expect(cronInput.enabled).toBe(true);
    expect(cronInput.state).toBe("scheduled");

    // Must link mission to cron job
    expect(mockUpdateMission).toHaveBeenCalledWith(
      "m-cron-test-001",
      expect.objectContaining({ cronJobId: "cj-mock-001" })
    );

    // Must push to Hermes
    expect(mockPushJobToHermes).toHaveBeenCalledWith("cj-mock-001");

    // Must NOT dispatch a one-shot chat
    const agentBackend = require("@/lib/backends").agentBackend;
    expect(agentBackend.dispatchMission).not.toHaveBeenCalled();
  });

  it("returns the linked mission in the response", async () => {
    const res = await postRoute({
      action: "dispatch",
      name: "Test Recurring Mission",
      instruction: "Do the thing",
      dispatchMode: "cron",
      schedule: "every 5m",
    });

    const json = await res.json() as { data?: { mission?: unknown } };
    expect(json.data).toBeDefined();
    expect(json.data!.mission).toBeDefined();
  });

  it("does NOT create a cron job when dispatchMode is 'now' (one-shot)", async () => {
    mockCreateMission.mockImplementation((data: Record<string, unknown>) =>
      makeMission({
        name: data.name,
        prompt: data.prompt,
        schedule: data.schedule,
        cronJobId: data.cronJobId ?? null,
        status: "dispatched",
      })
    );
    const agentBackend = require("@/lib/backends").agentBackend;
    agentBackend.dispatchMission.mockResolvedValue({ sessionId: "session-mock" });

    const res = await postRoute({
      action: "dispatch",
      name: "Test One-Shot Mission",
      instruction: "Do it now",
      dispatchMode: "now",
    });

    expect(res.status).toBe(201);
    // One-shot path must NOT call cron job creation
    expect(mockCreateCronJob).not.toHaveBeenCalled();
    expect(mockPushJobToHermes).not.toHaveBeenCalled();
    // Must dispatch the hermes chat
    expect(agentBackend.dispatchMission).toHaveBeenCalled();
  });

  it("returns 500 and marks mission as failed when cron job creation throws", async () => {
    mockCreateCronJob.mockImplementation(() => { throw new Error("DB write failed"); });
    mockGetMission.mockReturnValue(makeMission({ status: "failed" }));

    const res = await postRoute({
      action: "dispatch",
      name: "Failing Mission",
      instruction: "Will fail to create cron job",
      dispatchMode: "cron",
      schedule: "every 5m",
    });

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toContain("Failed to create cron job");
  });

  it("does NOT create cron job when dispatchMode is 'save' (draft)", async () => {
    mockCreateMission.mockImplementation((data: Record<string, unknown>) =>
      makeMission({
        name: data.name,
        schedule: data.schedule ?? null,
        cronJobId: null,
      })
    );

    const res = await postRoute({
      action: "dispatch",
      name: "Draft Mission",
      instruction: "Save as draft",
      dispatchMode: "save",
    });

    expect(res.status).toBe(201);
    expect(mockCreateCronJob).not.toHaveBeenCalled();
    expect(mockPushJobToHermes).not.toHaveBeenCalled();
  });

  it("does NOT create cron job when schedule is missing even with cron mode", async () => {
    const agentBackend = require("@/lib/backends").agentBackend;
    agentBackend.dispatchMission.mockResolvedValue({ sessionId: "session-mock" });

    await postRoute({
      action: "dispatch",
      name: "Cron No Schedule",
      instruction: "Recurring but no schedule set",
      dispatchMode: "cron",
      // no schedule provided — falls through to one-shot dispatch
    });

    // Without schedule, cron mode should fall back to one-shot
    expect(mockCreateCronJob).not.toHaveBeenCalled();
    expect(agentBackend.dispatchMission).toHaveBeenCalled();
  });

  it("logs a cron dispatch audit line on success", async () => {
    const mockAudit = require("@/lib/audit-log").appendAuditLine;

    await postRoute({
      action: "dispatch",
      name: "Audit Test",
      instruction: "Check audit trail",
      dispatchMode: "cron",
      schedule: "every 10m",
    });

    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "mission.cron_dispatch",
        ok: true,
      })
    );
  });

  it("pushes to hermes with the correct cron job id", async () => {
    mockCreateCronJob.mockReturnValue({ id: "cj-unique-001", name: "Unique Cron" });

    await postRoute({
      action: "dispatch",
      name: "Push ID Check",
      instruction: "Verify hermes push",
      dispatchMode: "cron",
      schedule: "every 5m",
    });

    expect(mockPushJobToHermes).toHaveBeenCalledWith("cj-unique-001");
  });
});
