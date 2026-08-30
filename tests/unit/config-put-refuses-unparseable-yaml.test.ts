/** @jest-environment node */

// T-0060 acceptance oracle — PUT /api/config must refuse to write over a
// config.yaml it could not parse.
//
// THE DEFECT. `readCachedConfig()` turns a YAML parse error into `{}`
// (config-cache.ts:105-110, "return empty config rather than crashing"). That is
// correct for the GET on the line above it and catastrophic two lines above a
// write: the PUT merges the incoming section into that `{}` and writes the
// result over the operator's file. A config.yaml holding models, providers,
// fallback chains and toolsets becomes 23 bytes, and the route answers
// 200 {"success":true}.
//
// WHAT IS AND IS NOT LOST. `backupFile` at route.ts:113 copies the file as it
// stands, twenty lines before the write, so the operator's original survives in
// <root>/backups/. The loss is recoverable. It is also SILENT: the return value
// of backupFile is discarded, the response says success, and the audit line
// records ok:true. Nobody is ever told the backup matters.
//
// WHY THE DEFENCE DID NOT COVER THIS. A correct refusal already exists for a
// different writer -- syncDefaultsToHermesConfig at config-sync.ts:69-80 backs
// up, refuses, logs the js-yaml line:col, and hands the backup path back to its
// caller. T-0054 tested THAT path, wrote "the write path refuses to clobber the
// file, so this is a reporting gap rather than a data-loss risk", and the
// singular "the write path" is the whole error. This route was never tested
// against a malformed file, and the note it produced is what kept it open.

const mockReadFileSync = jest.fn();
const mockWriteFileSync = jest.fn();
const mockExistsSync = jest.fn();
const mockMkdirSync = jest.fn();
const mockRenameSync = jest.fn();
const mockUnlinkSync = jest.fn();
const mockGetMetaPair = jest.fn();
const mockAppendAuditLine = jest.fn();
const mockLogApiError = jest.fn();

// config-put-deep-merge.test.ts stubs serverErrorFromCatch as a bare jest.fn().
// A bare fn returns undefined, so a route that falls into its catch answers
// `undefined` and every assertion below dies on `undefined.status` instead of
// reporting a 500. Returning a real response makes a wrong-path failure legible
// as a wrong path rather than as a broken test.
const mockServerError = () =>
  new Response(JSON.stringify({ error: "server error" }), {
    status: 500,
    headers: { "content-type": "application/json" },
  });

jest.mock("fs", () => ({
  readFileSync: mockReadFileSync,
  writeFileSync: mockWriteFileSync,
  existsSync: mockExistsSync,
  mkdirSync: mockMkdirSync,
  renameSync: mockRenameSync,
  unlinkSync: mockUnlinkSync,
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
  logApiError: mockLogApiError,
  serverErrorFromCatch: jest.fn(() => mockServerError()),
}));

jest.mock("@/lib/api-auth", () => ({}));

jest.mock("@/lib/audit-log", () => ({
  appendAuditLine: mockAppendAuditLine,
}));

// The config cache reads through this pair. Returning [] keeps the cache COLD,
// which is the normal case; one test below deliberately warms it.
jest.mock("@/lib/system-repository", () => ({
  getMetaPair: mockGetMetaPair,
  setMultipleStats: jest.fn(),
  deleteMetaPair: jest.fn(),
}));

import { join as joinPath } from "path";

import { NextRequest } from "next/server";

/** A duplicate mapping key: the same class of corruption config-sync.ts names. */
const MALFORMED = "agent:\n  max_turns: 100\n  max_turns: 200\n";

/** Malformed, with a live-looking secret beside the fault. */
const MALFORMED_WITH_SECRET =
  "model:\n  api_key: sk-live-DO-NOT-LEAK-ME\n  name: x\n  name: y\n";

const CONFIG_PATH = "/tmp/test-hermes/config.yaml";

function putRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/config", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

/** Every writeFileSync that targeted config.yaml itself or its staging tmpfile. */
function writesToConfig(): string[] {
  return mockWriteFileSync.mock.calls
    .map((c) => String(c[0]))
    .filter((p) => p === CONFIG_PATH || p.startsWith(`${CONFIG_PATH}.tmp-`));
}

/** Every writeFileSync that landed in the backups directory. */
function writesToBackups(): Array<[string, string]> {
  return mockWriteFileSync.mock.calls
    .filter((c) => String(c[0]).includes("backups"))
    .map((c) => [String(c[0]), String(c[1])] as [string, string]);
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.resetModules();
  mockExistsSync.mockReturnValue(true);
  mockGetMetaPair.mockReturnValue([]); // cold cache
});

describe("PUT /api/config refuses to write over a config.yaml it cannot parse", () => {
  it("answers 409 rather than 200", async () => {
    mockReadFileSync.mockReturnValue(MALFORMED);
    const { PUT } = await import("@/app/api/config/route");

    const res = await PUT(putRequest({ section: "agent", values: { max_turns: 5 } }));

    expect(res.status).toBe(409);
  });

  it("does not write config.yaml", async () => {
    // The assertion that pins the loss. Today there are two writeFileSync calls
    // and a renameSync onto config.yaml; the file becomes 23 bytes.
    mockReadFileSync.mockReturnValue(MALFORMED);
    const { PUT } = await import("@/app/api/config/route");

    await PUT(putRequest({ section: "agent", values: { verbose: true } }));

    expect(writesToConfig()).toEqual([]);
    expect(mockRenameSync).not.toHaveBeenCalled();
  });

  it("names the YAML fault, with its line and column", async () => {
    mockReadFileSync.mockReturnValue(MALFORMED);
    const { PUT } = await import("@/app/api/config/route");

    const res = await PUT(putRequest({ section: "agent", values: { verbose: true } }));
    const body = (await res.json()) as { error?: string };

    expect(body.error).toMatch(/duplicated mapping key/i);
    expect(body.error).toMatch(/\(\d+:\d+\)/);
  });

  it("tells the operator where the backup went", async () => {
    mockReadFileSync.mockReturnValue(MALFORMED);
    const { PUT } = await import("@/app/api/config/route");

    const res = await PUT(putRequest({ section: "agent", values: { verbose: true } }));
    const body = (await res.json()) as { error?: string };

    expect(body.error).toMatch(/\.bak/);
    expect(body.error).toMatch(/backups/);
  });

  it("does not spill config.yaml's contents into the error body", async () => {
    // js-yaml's message quotes the offending LINES of the file. This route
    // masks api_key on the way out (maskConfigSecrets) for exactly that reason,
    // so the refusal must carry the first line of the message and no more. This
    // is the assertion that pins that decision against a future "give them the
    // whole message, it is more helpful".
    mockReadFileSync.mockReturnValue(MALFORMED_WITH_SECRET);
    const { PUT } = await import("@/app/api/config/route");

    const res = await PUT(putRequest({ section: "agent", values: { verbose: true } }));
    const body = (await res.json()) as { error?: string };

    expect(body.error).not.toMatch(/sk-live/);
    expect(body.error).not.toMatch(/api_key/);
  });

  it("records the refusal in the audit log as a failure", async () => {
    // Today this logs ok:true, so the audit trail certifies a successful write
    // of a file that destroyed the operator's config.
    mockReadFileSync.mockReturnValue(MALFORMED);
    const { PUT } = await import("@/app/api/config/route");

    await PUT(putRequest({ section: "agent", values: { verbose: true } }));

    expect(mockAppendAuditLine).toHaveBeenCalledWith(
      expect.objectContaining({ action: "config.put", resource: "agent", ok: false }),
    );
    expect(mockAppendAuditLine).not.toHaveBeenCalledWith(
      expect.objectContaining({ ok: true }),
    );
  });

  it("refuses even when a warm cache could supply a last-known-good config", async () => {
    // The reason the fix must parse the file itself rather than teach
    // readCachedConfig a third return state. Within the 15s TTL the cache holds
    // the config as it was BEFORE the corruption, so a cache-based check sees
    // nothing wrong and the PUT silently REPLACES the operator's broken file
    // with a stale snapshot, discarding whatever they were mid-way through
    // hand-editing. Refusing is the only honest answer.
    mockGetMetaPair.mockReturnValue([
      { key: "config.cached_json", value: JSON.stringify({ agent: { max_turns: 100 } }) },
      { key: "config.cached_at", value: new Date().toISOString() },
    ]);
    mockReadFileSync.mockReturnValue(MALFORMED);
    const { PUT } = await import("@/app/api/config/route");

    const res = await PUT(putRequest({ section: "agent", values: { verbose: true } }));

    expect(res.status).toBe(409);
    expect(writesToConfig()).toEqual([]);
  });

  it("still takes the pre-write backup, so a bug in the refusal cannot be terminal", async () => {
    // GREEN PIN, not a repro. It holds the ruling that the backup stays at
    // route.ts:113, ahead of the parse: it is the only reason today's defect is
    // recoverable, and it is the path the refusal names. A later tidy-up that
    // moves it below the parse ("why back up a file we are not overwriting")
    // turns this red.
    mockReadFileSync.mockReturnValue(MALFORMED);
    const { PUT } = await import("@/app/api/config/route");

    await PUT(putRequest({ section: "agent", values: { verbose: true } }));

    const backups = writesToBackups();
    expect(backups).toHaveLength(1);
    expect(backups[0][1]).toBe(MALFORMED);
  });
});

describe("PUT /api/config still writes when config.yaml is well formed", () => {
  it("merges and writes as before", async () => {
    // GREEN CONTROL. Without it the fix could degenerate into "refuse
    // everything" and every assertion above would still pass.
    mockReadFileSync.mockReturnValue("agent:\n  max_turns: 100\n  verbose: false\n");
    const { PUT } = await import("@/app/api/config/route");

    const res = await PUT(putRequest({ section: "agent", values: { verbose: true } }));

    expect(res.status).toBe(200);
    expect(writesToConfig().length).toBeGreaterThan(0);
    expect(mockRenameSync).toHaveBeenCalled();
    expect(mockAppendAuditLine).toHaveBeenCalledWith(
      expect.objectContaining({ action: "config.put", ok: true }),
    );
  });
});

describe("the PUT path does not read config through the degrading reader", () => {
  it("does not call readCachedConfig", () => {
    // Source-level, deliberately. The behavioural tests above prove today's
    // symptom; this one pins the CAUSE, so nobody reintroduces a degrade-to-{}
    // read two lines above a write. Precedent for scanning source in a test:
    // tests/unit/read-only-actually-reads.test.ts.
    //
    // `fs` is mocked for this file, so read through requireActual.
    const realFs = jest.requireActual<typeof import("fs")>("fs");
    const text = realFs.readFileSync(
      joinPath(process.cwd(), "src", "app", "api", "config", "route.ts"),
      "utf-8",
    );

    const put = text.slice(text.indexOf("export async function PUT"));
    expect(put).not.toMatch(/readCachedConfig/);
  });
});
