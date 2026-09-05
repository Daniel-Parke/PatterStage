/** @jest-environment node */

import { execBaselineSchema } from "../helpers/baseline-db";

const mockExistsSync = jest.fn((path: string) => path.endsWith("/config.yaml"));

jest.mock("fs", () => {
  const actual = jest.requireActual<typeof import("fs")>("fs");
  return {
    ...actual,
    existsSync: (path: string) => mockExistsSync(path),
  };
});

let testDb: import("better-sqlite3").Database | null = null;

jest.mock("@/lib/db", () => ({
  getDb: () => testDb!,
  ensureDb: () => undefined,
}));

jest.mock("@/modules/hermes/lib/profile-paths", () => ({
  getHermesDefaultRoot: () => "/nonexistent-hermes",
}));

jest.mock("@/modules/hermes/lib/profile-discovery", () => ({
  importAllSkillsFromDisk: jest.fn(() => [{ success: true, slug: "skill-a", backupPath: null, error: null }]),
  discoverLocalProfiles: jest.fn(() => []),
  importDiscoveredProfile: jest.fn(),
}));

jest.mock("@/modules/hermes/lib/profile-pull", () => ({
  pullRootFromHermes: jest.fn(() => ({ success: true, slug: "default", backupPath: null, error: null })),
}));

jest.mock("@/lib/agent-root-repository", () => ({
  getAgentRoot: jest.fn(() => ({
    soulMd: "existing soul",
    agentsMd: "",
    frameworkMd: "",
    configYaml: "",
    userMd: "",
    memoryMd: "",
    disabledSkillsJson: "[]",
    platformToolsetsJson: "{}",
  })),
}));

beforeEach(() => {
  mockExistsSync.mockImplementation((path: string) => path.endsWith("/config.yaml"));
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require("better-sqlite3/lib/index.js") as typeof import("better-sqlite3");
  testDb = new Database(":memory:");
  execBaselineSchema(testDb);
  testDb
    .prepare(
      "INSERT INTO skills (skill_key, display_name, content) VALUES (?, ?, ?)",
    )
    .run("skill-a", "Skill A", "---\nname: a\n---\n");
});

afterEach(() => {
  testDb?.close();
  testDb = null;
  jest.clearAllMocks();
});

describe("importHermesStateFromDisk", () => {
  it("skips re-import when catalog and Bob soul already populated", async () => {
    const { importHermesStateFromDisk } = await import("@/modules/hermes/lib/state-import");
    const { importAllSkillsFromDisk } = await import("@/modules/hermes/lib/profile-discovery");

    const result = importHermesStateFromDisk();

    expect(result.skills).toEqual([]);
    expect(importAllSkillsFromDisk).not.toHaveBeenCalled();
  });

  it("forces import when force option is set", async () => {
    const { importHermesStateFromDisk } = await import("@/modules/hermes/lib/state-import");
    const { importAllSkillsFromDisk } = await import("@/modules/hermes/lib/profile-discovery");

    importHermesStateFromDisk({ force: true });

    expect(importAllSkillsFromDisk).toHaveBeenCalled();
  });

  it("throws when agent_root table is missing (migrate required)", async () => {
    testDb?.exec("DROP TABLE IF EXISTS agent_root");
    const { importHermesStateFromDisk } = await import("@/modules/hermes/lib/state-import");

    expect(() => importHermesStateFromDisk({ force: true })).toThrow(/npm run db:migrate/);
  });
});
