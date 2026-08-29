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

jest.mock("@/modules/hermes/lib/agent-runtime", () => ({
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

const mockRequireAuth = jest.fn((..._a: unknown[]): NextResponse | null => null);

jest.mock("@/lib/api-auth", () => ({
  requireNotReadOnly: jest.fn(() => null),
  isReadOnly: jest.fn(() => false),
}));

const mockResolveSafeProfileName = jest.fn(
  (param: string | null) => {
    const profile = (param || "default").trim();
    if (profile === "default" || profile === "") return { ok: true, profile: "default" };
    if (/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(profile)) return { ok: true, profile };
    return { ok: false, error: "Invalid profile name" };
  }
);

jest.mock("@/lib/fs/path-security", () => ({
  resolveSafeProfileName: (param: string | null) => mockResolveSafeProfileName(param),
  requireSafeProfileName: (param: string | null) => {
    const r = mockResolveSafeProfileName(param);
    if (r.ok) return { profile: r.profile };
    return NextResponse.json({ error: r.error }, { status: 400 });
  },
}));

import { NextRequest, NextResponse } from "next/server";

describe("PUT /api/skills/[name]/toggle", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockReturnValue(null);
  });

  // Read-only refusal is no longer asserted here, because it is no longer
  // enforced here. T-0048 deleted the per-route guard: `src/proxy.ts` refuses
  // every unsafe method under PS_READ_ONLY before a handler runs, so a test that
  // calls this handler directly bypasses the thing it means to check. The
  // guarantee is asserted per route, in both directions, in
  // tests/unit/read-only-actually-reads.test.ts.

  it("returns 400 on invalid JSON body (regression — was 500)", async () => {
    // Before parseJsonBody was extracted, request.json() was inside the
    // try/catch that returned 500. Refactor to use parseJsonBody so
    // invalid JSON now correctly returns 400 with an "Invalid JSON" error.
    const { PUT } = await import("@/app/api/skills/[name]/toggle/route");
    const req = new NextRequest("http://localhost/api/skills/test-skill/toggle", {
      method: "PUT",
      body: "{not valid json",
      headers: { "content-type": "application/json" },
    });

    const res = await PUT(req, { params: Promise.resolve({ name: "test-skill" }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid json/i);
  });

  // Restored from the T-0048 sweep, minus the `mockRequireAuth` assertion. What
  // remains is the real guarantee: the handler does not fall into the 500 branch.
  it("does not 500 on a well-formed toggle", async () => {
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
  });

});
