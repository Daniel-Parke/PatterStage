/** @jest-environment node */

// /api/tools only has GET and POST — PUT is tested via POST(action="configure").
//
// These used to verify that auth middleware was wired on the tool routes. It
// never was: `requireAuth` checked the read-only flag and authenticated
// nothing, and authentication has lived in src/proxy.ts since the security
// hotfix. T-0048 deleted the function; what remains here is the route's own
// behaviour.
const mockReadFileSync = jest.fn();
const mockWriteFileSync = jest.fn();
const mockExistsSync = jest.fn();

jest.mock("fs", () => ({
  readFileSync: mockReadFileSync,
  writeFileSync: mockWriteFileSync,
  existsSync: mockExistsSync,
}));

jest.mock("@/modules/hermes/lib/agent-runtime", () => ({
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
    psScripts: "/tmp/ch-data/scripts",
    psHardwareLogs: "/tmp/ch-data/logs",
  },
  getPsScriptsDir: () => "/tmp/ch-data/scripts",
  getPsHardwareLogDir: () => "/tmp/ch-data/logs",
}));

jest.mock("@/lib/api-logger", () => ({
  logApiError: jest.fn(),
}));

jest.mock("@/lib/api-auth", () => ({
  requireNotReadOnly: jest.fn(() => null),
  isReadOnly: jest.fn(() => false),
}));

import { NextRequest } from "next/server";

describe("POST /api/tools configure action auth", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExistsSync.mockReturnValue(true);
  });

  // Read-only refusal is no longer asserted here, because it is no longer
  // enforced here. T-0048 deleted the per-route guard: `src/proxy.ts` refuses
  // every unsafe method under PS_READ_ONLY before a handler runs, so a test that
  // calls this handler directly bypasses the thing it means to check. The
  // guarantee is asserted per route, in both directions, in
  // tests/unit/read-only-actually-reads.test.ts.


  // Restored from the T-0048 sweep. The mock plumbing this was entangled with is
  // gone; the 405 it asserts is real behaviour and worth keeping: the tools
  // registry is a read-only catalogue and POST is not a verb it supports.
  it("returns 405: the tool registry is a read-only catalogue", async () => {
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
