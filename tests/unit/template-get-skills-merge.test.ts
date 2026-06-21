/** @jest-environment node */

const mockExistsSync = jest.fn();
const mockReadFileSync = jest.fn();
const mockWriteFileSync = jest.fn();
const mockReaddirSync = jest.fn();
const mockMkdirSync = jest.fn();

jest.mock("fs", () => ({
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
  writeFileSync: mockWriteFileSync,
  readdirSync: mockReaddirSync,
  mkdirSync: mockMkdirSync,
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

describe("GET /api/templates — legacy skills → suggestedSkills", () => {
  beforeEach(() => jest.clearAllMocks());

  it("maps skills to suggestedSkills when suggestedSkills missing", async () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(["legacy.json"]);
    mockReadFileSync.mockImplementation((p: string) => {
      if (String(p).endsWith("legacy.json")) {
        return JSON.stringify({
          id: "ct_legacy",
          name: "Legacy",
          icon: "Zap",
          color: "cyan",
          category: "Custom",
          profile: "default",
          description: "",
          instruction: "x",
          context: "",
          goals: [],
          skills: ["skill-a"],
          dispatchMode: "now",
          schedule: "every 5m",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
      return "{}";
    });

    const { GET } = await import("@/app/api/templates/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    const legacy = body.data.templates.find((t: { id: string }) => t.id === "ct_legacy");
    expect(legacy).toBeDefined();
    expect(legacy.suggestedSkills).toEqual(["skill-a"]);
    expect(legacy.skills).toBeUndefined();
  });
});
