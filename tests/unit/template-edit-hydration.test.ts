/** @jest-environment node */

/**
 * Custom templates on disk may omit suggestedSkills and use legacy `skills`.
 * GET /api/templates must expose a single client shape for editors to hydrate.
 */

const mockReadFileSync = jest.fn();
const mockExistsSync = jest.fn();
const mockReaddirSync = jest.fn();

jest.mock("fs", () => ({
  existsSync: (...a: unknown[]) => mockExistsSync(...a) as boolean,
  mkdirSync: jest.fn(),
  readFileSync: (...a: unknown[]) => mockReadFileSync(...a) as string,
  writeFileSync: jest.fn(),
  readdirSync: (...a: unknown[]) => mockReaddirSync(...a) as string[],
  unlinkSync: jest.fn(),
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

jest.mock("@/lib/api-logger", () => ({
  logApiError: jest.fn(),
}));

describe("GET /api/templates — editor hydration shape", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(["hydrate.json"]);
    mockReadFileSync.mockImplementation((p: string) => {
      if (String(p).endsWith("hydrate.json")) {
        return JSON.stringify({
          id: "ct_hydrate",
          name: "H",
          icon: "Zap",
          color: "cyan",
          category: "Custom",
          profile: "alpha",
          description: "",
          instruction: "x",
          context: "",
          goals: [],
          skills: ["legacy-skill"],
          dispatchMode: "now",
          schedule: "every 5m",
          localDirs: ["/abs/a"],
          references: ["ref1"],
          defaultModel: "openai/gpt-4",
          defaultProvider: "openai",
          timeoutMinutes: 15,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
      return "{}";
    });
  });

  it("surfaces suggestedSkills, normalised localDirs, profile, model, refs, timeout", async () => {
    const { GET } = await import("@/app/api/templates/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    const t = body.data.templates.find((x: { id: string }) => x.id === "ct_hydrate");
    expect(t).toBeDefined();
    expect(t.suggestedSkills).toEqual(["legacy-skill"]);
    expect(t.skills).toBeUndefined();
    expect(t.localDirs).toEqual([{ path: "/abs/a", branch: null }]);
    expect(t.profile).toBe("alpha");
    expect(t.defaultModel).toBe("openai/gpt-4");
    expect(t.defaultProvider).toBe("openai");
    expect(t.references).toEqual(["ref1"]);
    expect(t.timeoutMinutes).toBe(15);
  });
});
