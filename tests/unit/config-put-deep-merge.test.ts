/** @jest-environment node */

// Integration regression: PUT /api/config must deep-merge a nested
// object patch into the existing section so sibling keys survive.
//
// Before the fix: the route did `config[section] = { ...current, ...values }`.
// When `values` contained a nested object (e.g. `{personalities: { default: ... }}`),
// the spread replaced the whole `personalities` object, wiping every sibling
// key. This test simulates that contract with a config.yaml that already
// has `personalities` populated and a PUT body that patches one nested
// key. After the fix (`deepMerge` in `src/lib/deep-merge.ts`), the
// untouched siblings survive.

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

jest.mock("@/modules/hermes/lib/agent-runtime", () => ({
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
  serverErrorFromCatch: jest.fn(),
}));

jest.mock("@/lib/api-auth", () => ({
  requireAuth: mockRequireAuth,
}));

jest.mock("@/lib/audit-log", () => ({
  appendAuditLine: jest.fn(),
}));

import { NextRequest } from "next/server";

describe("PUT /api/config deep merge (List 4 — Models/Settings)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockReturnValue(null);
    mockExistsSync.mockReturnValue(true);
  });

  // Core regression: editing one nested key (personalities.default)
  // must not wipe personalities.custom or personalities.archived.
  it("preserves sibling keys on a nested-object patch (personalities)", async () => {
    // Disk holds a config.yaml with both `personalities` and
    // `max_turns` set. The PUT only changes `personalities.default`.
    mockReadFileSync.mockReturnValue(
      [
        "agent:",
        "  max_turns: 100",
        "  personalities:",
        "    default: Hermes",
        "    custom: MyAgent",
        "    archived: Old",
        "",
      ].join("\n"),
    );

    const { PUT } = await import("@/app/api/config/route");
    const req = new NextRequest("http://localhost/api/config", {
      method: "PUT",
      body: JSON.stringify({
        section: "agent",
        values: { personalities: { default: "NewHermes" } },
      }),
    });
    const res = await PUT(req);

    expect(res.status).toBe(200);
    // `writeFileSync` is called twice on success: once by `backupFile`
    // (writes the pre-merge config to backups/) and once by the route
    // (writes the post-merge config back to disk). The second call is
    // the one we want to assert against. Decode the dumped YAML and
    // assert the shape.
    const written = mockWriteFileSync.mock.calls[1]?.[1] as string;
    expect(written).toMatch(/max_turns: 100/);
    expect(written).toMatch(/default: NewHermes/);
    // The shallow-merge bug: these would be missing.
    expect(written).toMatch(/custom: MyAgent/);
    expect(written).toMatch(/archived: Old/);
  });

  // Sibling-key check on the section top level: a patch to one key
  // must not wipe the others at the same depth.
  it("preserves sibling keys at the section top level (max_turns + verbose)", async () => {
    mockReadFileSync.mockReturnValue(
      ["agent:", "  max_turns: 100", "  verbose: false", ""].join("\n"),
    );

    const { PUT } = await import("@/app/api/config/route");
    const req = new NextRequest("http://localhost/api/config", {
      method: "PUT",
      body: JSON.stringify({
        section: "agent",
        values: { max_turns: 200 },
      }),
    });
    const res = await PUT(req);

    expect(res.status).toBe(200);
    // See note in the previous test: writeFileSync is called twice —
    // once for the backup, once for the post-merge write. The second
    // call is the post-merge config.
    const written = mockWriteFileSync.mock.calls[1]?.[1] as string;
    expect(written).toMatch(/max_turns: 200/);
    expect(written).toMatch(/verbose: false/);
  });
});
