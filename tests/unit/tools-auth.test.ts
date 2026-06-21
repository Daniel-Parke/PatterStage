/** @jest-environment node */

// These tests verify auth middleware is correctly wired on tool routes.
// /api/tools only has GET and POST — PUT is tested via POST(action="configure").

const mockRequireAuth = jest.fn();
const mockReadFileSync = jest.fn();
const mockWriteFileSync = jest.fn();
const mockExistsSync = jest.fn();

jest.mock("fs", () => ({
  readFileSync: mockReadFileSync,
  writeFileSync: mockWriteFileSync,
  existsSync: mockExistsSync,
}));

jest.mock("@/lib/hermes-agent-runtime", () => ({
  getActiveHermesPaths: jest.fn(() => ({
    root: "/tmp/test-hermes",
    config: "/tmp/test-hermes/config.yaml",
    env: "/tmp/test-hermes/.env",
    skills: "/tmp/test-hermes/skills",
    sessions: "/tmp/test-hermes/sessions",
    logs: "/tmp/test-hermes/logs",
    memoryDb: "/tmp/test-hermes/memory_store.db",
    cronJobs: "/tmp/test-hermes/cron/jobs.json",
    backups: "/tmp/test-hermes/backups",
    hermes: "/tmp/test-hermes/HERMES.md",
    agents: "/tmp/test-hermes/AGENTS.md",
    profiles: "/tmp/test-hermes/profiles",
    soul: "/tmp/test-hermes/SOUL.md",
  })),
  getActiveHermesHome: jest.fn(() => "/tmp/test-hermes"),
  getAgentLlmEndpoints: jest.fn(() => ({
    apiUrl: "http://127.0.0.1:9/v1/chat/completions",
    gatewayBase: "http://127.0.0.1:9",
  })),
}));

jest.mock("@/lib/paths", () => ({
  PS_DATA_DIR: "/tmp/ch-data",
  PATHS: {
    missions: "/tmp/ch-data/missions",
    patterStageDb: "/tmp/ch-data/control-hub.db",
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

jest.mock("@/lib/api-logger", () => ({
  logApiError: jest.fn(),
}));

jest.mock("@/lib/api-auth", () => ({
  requireAuth: mockRequireAuth,
  requireNotReadOnly: jest.fn(() => null),
  isReadOnly: jest.fn(() => false),
}));

import { NextRequest } from "next/server";

describe("POST /api/tools configure action auth", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExistsSync.mockReturnValue(true);
  });

  it("rejects when read-only mode is active", async () => {
    const readOnlyResponse = new Response("Read only", { status: 403 });
    mockRequireAuth.mockReturnValue(readOnlyResponse);

    const req = new NextRequest("http://localhost/api/tools", {
      method: "POST",
      body: JSON.stringify({ action: "configure", id: "terminal", enabled: true }),
    });
    const res = await POST(req);

    expect(res.status).toBe(403);
    expect(mockRequireAuth).toHaveBeenCalled();
  });

  it("rejects when API key is missing/invalid", async () => {
    mockRequireAuth.mockReturnValue(null);
    const authResponse = new Response("Unauthorized", { status: 401 });
    mockRequireAuth.mockReturnValue(authResponse);

    const req = new NextRequest("http://localhost/api/tools", {
      method: "POST",
      body: JSON.stringify({ action: "configure", id: "terminal", enabled: true }),
    });
    const res = await POST(req);

    expect(res.status).toBe(401);
    expect(mockRequireAuth).toHaveBeenCalled();
  });

  it("returns 405 when auth passes (POST not allowed on read-only tool registry)", async () => {
    mockRequireAuth.mockReturnValue(null);

    const req = new NextRequest("http://localhost/api/tools", {
      method: "POST",
      body: JSON.stringify({ action: "configure", id: "terminal", enabled: true }),
    });
    const res = await POST(req);

    expect(res.status).toBe(405);
  });
});

// Helper to call POST /api/tools
async function POST(req: NextRequest) {
  const { POST } = await import("@/app/api/tools/route");
  return POST(req);
}
