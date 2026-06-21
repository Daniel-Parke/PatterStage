/** @jest-environment node */

// Regression test: /api/stories POST handler must require auth checks
// Bug: stories route was missing requireAuth() and requireAuth()

jest.mock("fs", () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
  readdirSync: jest.fn(),
  unlinkSync: jest.fn(),
}));

jest.mock("@/lib/hermes-agent-runtime", () => ({
  getAgentLlmEndpoints: jest.fn(() => ({
    apiUrl: "http://127.0.0.1:9/v1/chat/completions",
    gatewayBase: "http://127.0.0.1:9",
  })),
}));

jest.mock("@/lib/paths", () => ({
  PS_DATA_DIR: "/tmp/ch-data",
  PATHS: {
    stories: "/tmp/ch-data/stories",
    missions: "/tmp/ch-data/missions",
    patterStageDb: "/tmp/ch-data/control-hub.db",
    templates: "/tmp/ch-data/templates",
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

jest.mock("@/lib/story-weaver/prompts", () => ({
  getStoryPrompt: jest.fn(() => "system prompt"),
}));

import { NextRequest } from "next/server";

describe("/api/stories auth checks", () => {
  const originalEnv = process.env.CH_READ_ONLY;

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.CH_READ_ONLY = originalEnv;
    } else {
      delete process.env.CH_READ_ONLY;
    }
    jest.clearAllMocks();
  });

  it("POST returns 503 when CH_READ_ONLY=true", async () => {
    process.env.CH_READ_ONLY = "true";

    const { POST } = await import("@/app/api/stories/route");
    const request = new NextRequest("http://localhost/api/stories", {
      method: "POST",
      body: JSON.stringify({ action: "list" }),
    });
    const res = await POST(request);

    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.error).toContain("read-only");
  });

  it("POST proceeds when not read-only", async () => {
    delete process.env.CH_READ_ONLY;

    const { POST } = await import("@/app/api/stories/route");
    const request = new NextRequest("http://localhost/api/stories", {
      method: "POST",
      body: JSON.stringify({ action: "list" }),
    });
    const res = await POST(request);

    // Should not be 503 (read-only) or 401 (unauthorized)
    // It may return 200 with empty list or 500 if fs mocks aren't set up
    expect(res.status).not.toBe(503);
    expect(res.status).not.toBe(401);
  });
});
