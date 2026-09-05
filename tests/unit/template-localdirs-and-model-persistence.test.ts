/** @jest-environment node */

import { NextRequest } from "next/server";

const mockRequireAuth = jest.fn();

jest.mock("@/lib/api-auth", () => ({
}));

jest.mock("@/lib/api-logger", () => ({
  logApiError: jest.fn(),
}));

jest.mock("@/lib/audit-log", () => ({
  appendAuditLine: jest.fn(),
}));

jest.mock("@/lib/paths", () => ({
  PS_DATA_DIR: "/tmp/ch-data",
  PATHS: {
    templates: "/tmp/test-templates",
    missions: "/tmp/ch-data/missions",
    patterStageDb: "/tmp/ch-data/control-hub.db",
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

jest.mock("@/lib/schema", () => ({
  parseTemplatePackManifestV1: jest.fn(),
}));

const mockExistsSync = jest.fn();
const mockMkdirSync = jest.fn();
const mockReadFileSync = jest.fn();
const mockWriteFileSync = jest.fn();
const mockReaddirSync = jest.fn();
const mockUnlinkSync = jest.fn();

jest.mock("fs", () => ({
  existsSync: (...a: unknown[]) => mockExistsSync(...a) as boolean,
  mkdirSync: (...a: unknown[]) => mockMkdirSync(...a),
  readFileSync: (...a: unknown[]) => mockReadFileSync(...a) as string,
  writeFileSync: (...a: unknown[]) => mockWriteFileSync(...a),
  readdirSync: (...a: unknown[]) => mockReaddirSync(...a) as string[],
  unlinkSync: (...a: unknown[]) => mockUnlinkSync(...a),
}));

describe("POST /api/templates — localDirs, model, suggestedSkills persistence", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockReturnValue(null);
    mockRequireAuth.mockReturnValue(null);
    mockExistsSync.mockReturnValue(true);
  });

  it("writes normalised LocalDirEntry[] and Hermes model strings; GET round-trips", async () => {
    mockWriteFileSync.mockImplementation((_path: string, _content: string) => undefined);
    mockReaddirSync.mockReturnValue([]);

    const { POST } = await import("@/app/api/templates/route");
    const createReq = new NextRequest("http://localhost/api/templates", {
      method: "POST",
      body: JSON.stringify({
        action: "create",
        name: "T1",
        instruction: "go",
        profile: "default",
        suggestedSkills: ["skill-one"],
        localDirs: ["/legacy/path", { path: "/other", branch: "dev" }],
        defaultModel: "anthropic/claude-sonnet-4",
        defaultProvider: "anthropic",
        references: ["https://example.com"],
        timeoutMinutes: 42,
      }),
    });
    const postRes = await POST(createReq);
    expect(postRes.status).toBe(200);
    expect(mockWriteFileSync).toHaveBeenCalled();
    const disk = JSON.parse(
      mockWriteFileSync.mock.calls[mockWriteFileSync.mock.calls.length - 1][1] as string,
    ) as {
      id: string;
      localDirs: { path: string; branch: string | null }[];
      defaultModel: string;
      defaultProvider: string;
      suggestedSkills: string[];
      skills?: string[];
    };
    expect(disk.localDirs).toEqual([
      { path: "/legacy/path", branch: null },
      { path: "/other", branch: "dev" },
    ]);
    expect(disk.defaultModel).toBe("anthropic/claude-sonnet-4");
    expect(disk.defaultProvider).toBe("anthropic");
    expect(disk.suggestedSkills).toEqual(["skill-one"]);
    expect(disk.skills).toBeUndefined();

    mockReaddirSync.mockReturnValue([`${disk.id}.json`]);
    mockReadFileSync.mockImplementation((p: string) => {
      if (String(p).endsWith(".json")) {
        return JSON.stringify(disk);
      }
      return "{}";
    });

    const { GET } = await import("@/app/api/templates/route");
    const getRes = await GET();
    const body = await getRes.json();
    const found = body.data.templates.find((t: { id: string }) => t.id === disk.id);
    expect(found).toBeDefined();
    expect(found.localDirs).toEqual(disk.localDirs);
    expect(found.suggestedSkills).toEqual(["skill-one"]);
    expect(found.defaultModel).toBe("anthropic/claude-sonnet-4");
    expect(found.defaultProvider).toBe("anthropic");
    expect(found.references).toEqual(["https://example.com"]);
    expect(found.timeoutMinutes).toBe(42);
  });
});
