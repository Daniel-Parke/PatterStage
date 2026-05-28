/** @jest-environment node */

const mockExistsSync = jest.fn();
const mockReadFileSync = jest.fn();
const mockWriteFileSync = jest.fn();
const mockReaddirSync = jest.fn(() => []);

jest.mock("fs", () => ({
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
  writeFileSync: mockWriteFileSync,
  readdirSync: mockReaddirSync,
}));

jest.mock("@/lib/hermes-agent-runtime", () => ({
  getActiveHermesHome: jest.fn(() => "/tmp/test-hermes"),
  getActiveHermesPaths: jest.fn(() => ({
    root: "/tmp/test-hermes",
    config: "/tmp/test-hermes/config.yaml",
    env: "/tmp/test-hermes/.env",
    soul: "/tmp/test-hermes/SOUL.md",
    hermes: "/tmp/test-hermes/HERMES.md",
    agents: "/tmp/test-hermes/AGENTS.md",
    skills: "/tmp/test-hermes/skills",
    profiles: "/tmp/test-hermes/profiles",
    sessions: "/tmp/test-hermes/sessions",
    logs: "/tmp/test-hermes/logs",
    backups: "/tmp/test-hermes/backups",
    cronJobs: "/tmp/test-hermes/cron/jobs.json",
    memoryDb: "/tmp/test-hermes/memory_store.db",
  })),
  getAgentLlmEndpoints: jest.fn(() => ({
    apiUrl: "http://127.0.0.1:9/v1/chat/completions",
    gatewayBase: "http://127.0.0.1:9",
  })),
}));

jest.mock("@/lib/api-logger", () => ({
  logApiError: jest.fn(),
}));

const mockRequireAuth = jest.fn(() => null);

jest.mock("@/lib/api-auth", () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
  isChReadOnly: jest.fn(() => false),
}));

const mockResolveSafeProfileName = jest.fn(
  (param: string | null) => {
    const profile = (param || "default").trim();
    if (profile === "default" || profile === "") return { ok: true, profile: "default" };
    if (/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(profile)) return { ok: true, profile };
    return { ok: false, error: "Invalid profile name" };
  }
);

jest.mock("@/lib/path-security", () => ({
  resolveSafeProfileName: (...args: unknown[]) => mockResolveSafeProfileName(...args),
}));

import { NextRequest, NextResponse } from "next/server";

describe("PUT /api/skills/[name]/toggle", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockReturnValue(null);
  });

  it("rejects request when requireAuth returns a response (read-only)", async () => {
    const readOnlyResponse = NextResponse.json(
      { error: "Read-only mode" },
      { status: 403 }
    );
    mockRequireAuth.mockReturnValue(readOnlyResponse);

    const { PUT } = await import("@/app/api/skills/[name]/toggle/route");
    const req = new NextRequest("http://localhost/api/skills/test-skill/toggle", {
      method: "PUT",
      body: JSON.stringify({ enabled: true }),
      headers: { "content-type": "application/json" },
    });

    const res = await PUT(req, { params: Promise.resolve({ name: "test-skill" }) });

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe("Read-only mode");
  });

  it("rejects request when requireAuth returns unauthorized", async () => {
    const authResponse = NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
    mockRequireAuth.mockReturnValue(authResponse);

    const { PUT } = await import("@/app/api/skills/[name]/toggle/route");
    const req = new NextRequest("http://localhost/api/skills/test-skill/toggle", {
      method: "PUT",
      body: JSON.stringify({ enabled: true }),
      headers: { "content-type": "application/json" },
    });

    const res = await PUT(req, { params: Promise.resolve({ name: "test-skill" }) });

    expect(res.status).toBe(401);
  });

  it("allows toggle when auth passes", async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue("skills:\n  enabled: []\n");

    const { PUT } = await import("@/app/api/skills/[name]/toggle/route");
    const req = new NextRequest("http://localhost/api/skills/test-skill/toggle", {
      method: "PUT",
      body: JSON.stringify({ enabled: true }),
      headers: { "content-type": "application/json" },
    });

    const res = await PUT(req, { params: Promise.resolve({ name: "test-skill" }) });

    expect(res.status).toBeLessThan(500);
    expect(mockRequireAuth).toHaveBeenCalled();
  });
});
