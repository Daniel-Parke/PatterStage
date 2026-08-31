/** @jest-environment node */

const mockExistsSync = jest.fn();
const mockReadFileSync = jest.fn();
const mockWriteFileSync = jest.fn();
const mockReaddirSync = jest.fn();
const mockStatSync = jest.fn();
const mockMkdirSync = jest.fn();

jest.mock("fs", () => ({
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
  writeFileSync: mockWriteFileSync,
  readdirSync: mockReaddirSync,
  statSync: mockStatSync,
  mkdirSync: mockMkdirSync,
  rmSync: jest.fn(),
}));

const testHermesRoot = "/tmp/test-hermes";
const testHermesPaths = {
  root: testHermesRoot,
  env: testHermesRoot + "/.env",
  soul: testHermesRoot + "/SOUL.md",
  hermes: testHermesRoot + "/HERMES.md",
  agents: testHermesRoot + "/AGENTS.md",
  skills: testHermesRoot + "/skills",
  profiles: testHermesRoot + "/profiles",
  sessions: testHermesRoot + "/sessions",
  logs: testHermesRoot + "/logs",
  config: testHermesRoot + "/config.yaml",
  backups: testHermesRoot + "/backups",
  cronJobs: testHermesRoot + "/cron/jobs.json",
  memoryDb: testHermesRoot + "/memory_store.db",
};

jest.mock("@/modules/hermes/lib/agent-runtime", () => ({
  getActiveHermesPaths: jest.fn(() => testHermesPaths),
  getActiveHermesHome: jest.fn(() => testHermesRoot),
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
}));

// /api/memory now probes the DB-owned active provider (like MemorySync) instead
// of regex-parsing config.yaml. Mock the provider so the GET test controls stats.
const mockMemoryStats = jest.fn();
jest.mock("@/lib/memory/memory-providers", () => ({
  getMemoryProviderType: jest.fn(() => "hindsight"),
  // `type` is part of the MemoryProvider contract and the route now reports
  // it rather than a hardcoded literal, so a stand-in that omits it is a
  // provider that cannot say what it is. Before T-0077 this mock passed only
  // because the route answered "hindsight" whatever it was handed.
  getActiveMemoryProvider: jest.fn(() => ({ type: "hindsight", stats: mockMemoryStats })),
  // The route reads the DB-owned config on the unreachable path so it can name
  // WHICH backend failed and at what address.
  getActiveMemoryConfig: jest.fn(() => ({
    type: "hindsight",
    config: { host: "127.0.0.1", port: 9177, bank: "hermes" },
  })),
}));

jest.mock("@/lib/audit-log", () => ({
  appendAuditLine: jest.fn(),
}));

jest.mock("@/lib/skills-repository", () => ({
  // An empty catalog, read four ways. The route reads the metadata-only shape
  // and resolveEffectiveDisabledSkills reads the keys, so a mock that offers
  // only listSkills leaves the route calling `undefined()` and reports the
  // resulting throw as a 500 rather than the empty 200 this suite asserts.
  listSkills: jest.fn(() => []),
  listSkillCatalog: jest.fn(() => []),
  listSkillKeys: jest.fn(() => []),
  countSkills: jest.fn(() => 0),
  deriveCategory: jest.fn(() => "uncategorized"),
}));

jest.mock("@/lib/agent-root-repository", () => ({
  getAgentRoot: jest.fn(() => ({
    disabledSkillsJson: "[]",
  })),
}));

jest.mock("@/modules/hermes/lib/profiles-repository", () => ({
  getDisabledSkills: jest.fn(() => []),
  getProfile: jest.fn(() => null),
}));

jest.mock("@/lib/sessions/sessions-api-guard", () => ({
  sessionsRateLimitResponse: jest.fn(() => null),
}));

import { mockRequest } from "../helpers/api-test-helpers";

describe("GET /api/tools", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns Hermes toolset catalog", async () => {
    const { GET } = await import("@/app/api/tools/route");
    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(data.data.platforms)).toBe(true);
    expect(Array.isArray(data.data.toolsets)).toBe(true);
    expect(data.data.toolsets.some((t: { id: string }) => t.id === "terminal")).toBe(true);
  });
});

describe("GET /api/config", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns parsed config", async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(
      "agent:\n  max_turns: 100\nmodel:\n  default: test-model\n"
    );

    const { GET } = await import("@/app/api/config/route");
    const res = await GET(mockRequest("http://127.0.0.1/api/test"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.data).toBeDefined();
  });

  // Regression guard: the masking helper (maskApiKeyField) was extracted
  // from an inline if/else pair, and the original code had two branches
  // (model.api_key and auxiliary.<task>.api_key). This test exercises
  // BOTH branches so a future refactor that drops one of them would
  // be caught.
  it("masks model.api_key and auxiliary.<task>.api_key in the response", async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(
      "model:\n  api_key: sk-supersecretapikey1234\n  default: test-model\nauxiliary:\n  vision:\n    api_key: sk-visionkeyapikey1234\n  embed:\n    api_key: sk-embedkeyapikey1234\n"
    );

    const { GET } = await import("@/app/api/config/route");
    const res = await GET(mockRequest("http://127.0.0.1/api/test"));
    const data = await res.json();

    // The original keys must NOT appear in the response.
    expect(JSON.stringify(data)).not.toContain("supersecretapikey1234");
    expect(JSON.stringify(data)).not.toContain("visionkeyapikey1234");
    expect(JSON.stringify(data)).not.toContain("embedkeyapikey1234");
    // The masked form (first 4 + •••• + last 4) MUST appear.
    expect(JSON.stringify(data)).toContain("sk-s••••1234");
    expect(JSON.stringify(data)).toContain("sk-v••••1234");
    expect(JSON.stringify(data)).toContain("sk-e••••1234");
  });
});

describe("GET /api/skills", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns empty when no skills directory", async () => {
    mockExistsSync.mockImplementation((p: string) => {
      if (p.endsWith("skills")) return false;
      return false;
    });

    const { NextRequest } = await import("next/server");
    const request = new NextRequest("http://localhost/api/skills");
    const { GET } = await import("@/app/api/skills/route");
    const res = await GET(request);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.data).toBeDefined();
    expect(data.data.total).toBe(0);
  });
});

describe("GET /api/templates", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns custom templates", async () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(["test-template.json"]);
    mockReadFileSync.mockReturnValue(
      JSON.stringify({
        id: "custom-1",
        name: "Custom Template",
        instruction: "Do stuff",
      })
    );

    const { GET } = await import("@/app/api/templates/route");
    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.data.templates).toBeDefined();
  });
});

describe("GET /api/memory", () => {
  beforeEach(() => jest.clearAllMocks());

  it("reports a live Hindsight install from the provider probe (not config.yaml)", async () => {
    mockMemoryStats.mockResolvedValue({ available: true, factCount: 17638 });

    const { GET } = await import("@/app/api/memory/route");
    const res = await GET(mockRequest("http://127.0.0.1/api/test"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.data.provider).toBe("hindsight");
    expect(data.data.available).toBe(true);
    expect(data.data.total).toBe(17638);
  });

  it("names the unreachable provider rather than flattening it to 'none'", async () => {
    // CHANGED DELIBERATELY at T-0077. This asserted a flat "none" for every
    // unreachable case, which collapsed two different problems into one word:
    // "nothing is configured" and "the provider you chose is configured and not
    // answering". The operator cannot act on the second without being told
    // WHICH backend is meant, so the route now reports the active type and the
    // endpoint it tried. `available: false` is unchanged — the honesty about
    // reachability was never the problem.
    mockMemoryStats.mockResolvedValue({ available: false, factCount: 0 });

    const { GET } = await import("@/app/api/memory/route");
    const res = await GET(mockRequest("http://127.0.0.1/api/test"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.data.available).toBe(false);
    expect(data.data.provider).toBe("hindsight");
    expect(data.data.message).toMatch(/hindsight/i);
    expect(data.data.message).toMatch(/127\.0\.0\.1:9177/);
  });
});
