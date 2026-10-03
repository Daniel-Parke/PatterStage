/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports */

// Integration regression: PUT /api/config must deep-merge a nested
// object patch into the existing section so sibling keys survive.
//
// Before the fix: the route did `config[section] = { ...current, ...values }`.
// When `values` contained a nested object (e.g. `{personalities: { default: ... }}`),
// the spread replaced the whole `personalities` object, wiping every sibling
// key. This test simulates that contract with a config.yaml that already
// has `personalities` populated and a PUT body that patches one nested
// key. After the fix (`deepMerge` in `src/lib/config/deep-merge.ts`), the
// untouched siblings survive.

const mockReadFileSync = jest.fn();
const mockWriteFileSync = jest.fn();
const mockExistsSync = jest.fn();
const mockMkdirSync = jest.fn();
const mockRequireAuth = jest.fn();
// The route writes config.yaml through `writeHermesConfigFile`, which stages to
// a tmpfile and renames. A mock without these two is a route that throws 500 on
// the success path, so they belong to the write, not to any one assertion.
const mockRenameSync = jest.fn();
const mockUnlinkSync = jest.fn();

jest.mock("fs", () => ({
  readFileSync: mockReadFileSync,
  writeFileSync: mockWriteFileSync,
  existsSync: mockExistsSync,
  mkdirSync: mockMkdirSync,
  renameSync: mockRenameSync,
  unlinkSync: mockUnlinkSync,
}));

jest.mock("@/modules/hermes/lib/agent-runtime", () => require("../helpers/mocks").agentRuntimeMock());

jest.mock("@/lib/host/paths", () => require("../helpers/mocks").pathsMock());

jest.mock("@/lib/api/api-logger", () => ({
  logApiError: jest.fn(),
  serverErrorFromCatch: jest.fn(),
}));

jest.mock("@/lib/api/api-auth", () => ({
}));

jest.mock("@/lib/api/audit-log", () => ({
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
    // (writes the pre-merge config to backups/) and once by the route's
    // write helper (stages the post-merge config to a tmpfile, which is
    // then renamed over config.yaml). The second call is the one we want
    // to assert against, same content whatever the path argument says.
    // Decode the dumped YAML and assert the shape.
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
