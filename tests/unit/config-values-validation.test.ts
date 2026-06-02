/** @jest-environment node */

// Regression: Config PUT must reject non-object `values`
// Bug: passing values as string/array caused deepMerge to crash with Object.keys()

const mockReadFileSync = jest.fn();
const mockWriteFileSync = jest.fn();
const mockExistsSync = jest.fn();
const mockMkdirSync = jest.fn();
const mockRequireAuth = jest.fn();

jest.mock("fs", () => ({
  readFileSync: mockReadFileSync,
  writeFileSync: mockWriteFileSync,
  existsSync: mockExistsSync,
  mkdirSync: mockMkdirSync,
}));

jest.mock("@/lib/hermes-agent-runtime", () => ({
  getActiveHermesPaths: jest.fn(() => ({
    root: "/tmp/test-hermes",
    config: "/tmp/test-hermes/config.yaml",
    backups: "/tmp/test-hermes/backups",
    env: "/tmp/test-hermes/.env",
    soul: "/tmp/test-hermes/SOUL.md",
    hermes: "/tmp/test-hermes/HERMES.md",
    agents: "/tmp/test-hermes/AGENTS.md",
    skills: "/tmp/test-hermes/skills",
    profiles: "/tmp/test-hermes/profiles",
    sessions: "/tmp/test-hermes/sessions",
    logs: "/tmp/test-hermes/logs",
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
  CH_DATA_DIR: "/tmp/ch-data",
  PATHS: {
    missions: "/tmp/ch-data/missions",
    controlHubDb: "/tmp/ch-data/control-hub.db",
    templates: "/tmp/ch-data/templates",
    stories: "/tmp/ch-data/stories",
    recroom: "/tmp/ch-data/recroom",
    workspaces: "/tmp/ch-data/workspaces",
    auditLog: "/tmp/ch-data/audit",
    chScripts: "/tmp/ch-data/scripts",
    chHardwareLogs: "/tmp/ch-data/logs",
  },
  getChScriptsDir: () => "/tmp/ch-data/scripts",
  getChHardwareLogDir: () => "/tmp/ch-data/logs",
}));

jest.mock("@/lib/api-logger", () => ({
  logApiError: jest.fn(),
}));

jest.mock("@/lib/api-auth", () => ({
  requireAuth: mockRequireAuth,
}));

jest.mock("@/lib/audit-log", () => ({
  appendAuditLine: jest.fn(),
}));

import { NextRequest } from "next/server";

describe("PUT /api/config values validation regression", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReadFileSync.mockReturnValue("agent:\n  personality: technical\n");
    mockExistsSync.mockReturnValue(true);
    mockRequireAuth.mockReturnValue(null);
    mockRequireAuth.mockReturnValue(null);
  });

  it("rejects when values is a string", async () => {
    const { PUT } = await import("@/app/api/config/route");
    const req = new NextRequest("http://localhost/api/config", {
      method: "PUT",
      body: JSON.stringify({ section: "agent", values: "invalid" }),
    });
    const res = await PUT(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/values must be an object/i);
  });

  it("rejects when values is an array", async () => {
    const { PUT } = await import("@/app/api/config/route");
    const req = new NextRequest("http://localhost/api/config", {
      method: "PUT",
      body: JSON.stringify({ section: "agent", values: ["a", "b"] }),
    });
    const res = await PUT(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/values must be an object/i);
  });

  it("rejects when values is null", async () => {
    const { PUT } = await import("@/app/api/config/route");
    const req = new NextRequest("http://localhost/api/config", {
      method: "PUT",
      body: JSON.stringify({ section: "agent", values: null }),
    });
    const res = await PUT(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/values/i);
  });

  it("accepts when values is a valid object", async () => {
    const { PUT } = await import("@/app/api/config/route");
    const req = new NextRequest("http://localhost/api/config", {
      method: "PUT",
      body: JSON.stringify({ section: "agent", values: { personality: "creative" } }),
    });
    const res = await PUT(req);

    // Should not return 400
    expect(res.status).not.toBe(400);
  });

  // Regression for: PUT used to call request.json() inside the main
  // try/catch, so malformed JSON returned 500 (caught by the catch-all).
  // After adopting parseJsonBody (hoisted out of the main try/catch),
  // malformed JSON now correctly returns 400 with a parse error message.
  it("returns 400 (not 500) when request body is malformed JSON", async () => {
    const { PUT } = await import("@/app/api/config/route");
    const req = new NextRequest("http://localhost/api/config", {
      method: "PUT",
      // Intentionally truncated JSON that will fail to parse
      body: "{this is not valid json",
    });
    const res = await PUT(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/invalid json/i);
  });
});
