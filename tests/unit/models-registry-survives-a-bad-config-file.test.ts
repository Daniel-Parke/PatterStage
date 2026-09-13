/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports */

// ═══════════════════════════════════════════════════════════════
// A config-file problem must not take the Models page with it.
//
// The readiness answer (the product's one "do I have a model?") is resolved in
// GET /api/models/defaults, which is also the endpoint the Models page reads
// its slot uuids from. Two things made that a page-killing coupling:
//
//   1. config-cache read the file OUTSIDE its try — only yaml.load was
//      guarded — so EACCES/EISDIR/EBUSY propagated out of
//      readCachedConfigResult() instead of being reported in its `error`.
//   2. The route calls it inside the handler try, whose catch answers 500,
//      and useModelsRegistry treats that endpoint as throw-on-error. So a
//      config.yaml the process could not open blanked the models table, the
//      credentials panel and every slot with "Failed to load registry".
//
// The registry lives in SQLite and has nothing to do with that file. What a
// broken config file may take away is the one sentence it is evidence for.
// ═══════════════════════════════════════════════════════════════

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// ── config-cache's filesystem branch, pointed at paths we control ──
const tempDir = mkdtempSync(join(tmpdir(), "bad-config-registry-"));
// A DIRECTORY where the config file should be. readFileSync answers EISDIR on
// both Windows and Linux, so the test reproduces a real unreadable-file errno
// without mocking fs and pretending.
const unreadableConfigPath = join(tempDir, "config-is-a-directory");
mkdirSync(unreadableConfigPath);
const goodConfigPath = join(tempDir, "config.yaml");
writeFileSync(goodConfigPath, "model:\n  default: MiniMax-M3\n  provider: minimax\n");

const activeConfigPath = { value: unreadableConfigPath };

jest.mock("@/modules/hermes/lib/agent-runtime", () => ({
  getActiveHermesPaths: () => ({
    root: tempDir,
    logs: tempDir,
    config: activeConfigPath.value,
    env: join(tempDir, ".env"),
    backups: join(tempDir, "backups"),
    sessions: join(tempDir, "sessions"),
    memoryDb: join(tempDir, "memory.db"),
  }),
}));

// The meta-keyed cache is not what is under test: keep it permanently empty so
// every read takes the filesystem branch.
jest.mock("@/lib/system/system-repository", () => ({
  getMetaPair: () => [],
  setMultipleStats: () => undefined,
  deleteMetaPair: () => undefined,
}));

afterAll(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("config-cache reports an unreadable file instead of throwing", () => {
  // requireActual, because the route half of this file mocks the same module
  // at its boundary. Its own imports (workspace paths, the meta cache) still
  // resolve through the mocks above, which is the point.
  const realConfigCache = () =>
    jest.requireActual("@/lib/config/config-cache") as typeof import("@/lib/config/config-cache");

  it("returns an error result for a config.yaml it cannot read", () => {
    activeConfigPath.value = unreadableConfigPath;

    const result = realConfigCache().readCachedConfigResult();

    expect(result.config).toEqual({});
    expect(result.error).toMatch(/EISDIR/);
  });

  it("readCachedConfig degrades to {} rather than throwing, as its contract says", () => {
    activeConfigPath.value = unreadableConfigPath;
    const { readCachedConfig } = realConfigCache();

    expect(() => readCachedConfig()).not.toThrow();
    expect(readCachedConfig()).toEqual({});
  });

  it("GREEN CONTROL: a readable config is still read and reported clean", () => {
    activeConfigPath.value = goodConfigPath;

    const result = realConfigCache().readCachedConfigResult();

    expect(result.error).toBeNull();
    expect(result.config).toEqual({ model: { default: "MiniMax-M3", provider: "minimax" } });
  });
});

// ── The route ────────────────────────────────────────────────────
//
// Mocked at the module boundary so both failure modes (reporting an error, and
// throwing outright) can be driven, whatever config-cache does today.

const configResult: {
  value: { config: Record<string, unknown>; error: string | null };
  throws: Error | null;
} = {
  value: { config: {}, error: null },
  throws: null,
};

jest.mock("@/lib/config/config-cache", () => ({
  readCachedConfigResult: () => {
    if (configResult.throws) throw configResult.throws;
    return configResult.value;
  },
}));

jest.mock("next/server", () => require("../helpers/mocks").nextServerMock());

// Keep serverErrorFromCatch REAL: a 500 that this file expects not to happen
// must be a 500 the route really produces, not a mock artefact.
jest.mock("@/lib/api/api-logger", () => {
  const actual = jest.requireActual("@/lib/api/api-logger") as Record<string, unknown>;
  return { ...actual, logApiError: jest.fn() };
});

const DEFAULTS = {
  agent: "m_1",
  hindsight: null,
  compression: null,
  vision: null,
  web_extract: null,
  session_search: null,
  title_generation: null,
  skills_hub: null,
  mcp: null,
  triage_specifier: null,
  approval: null,
  delegation: null,
};

jest.mock("@/lib/models/models-repository", () => ({
  getModelDefaults: () => DEFAULTS,
  getDefaultModel: () => ({ id: "m_1", name: "gpt-4o", modelId: "gpt-4o", provider: "openai" }),
  setDefaultModel: jest.fn(),
}));

jest.mock("@/lib/api/audit-log", () => ({ appendAuditLine: jest.fn() }));
jest.mock("@/lib/analytics/record-event", () => ({ recordEvent: jest.fn() }));
jest.mock("@/modules/hermes/lib/config-sync", () => ({
  finalizeRootConfigOnDisk: jest.fn(() => ({
    appliedModelDefaults: false,
    backupPath: null,
    error: null,
  })),
}));

async function getDefaults(): Promise<{ status: number; body: Record<string, unknown> }> {
  const route = require("@/app/api/models/defaults/route") as {
    GET: (req: unknown) => Promise<{ status: number; json: () => Promise<unknown> }>;
  };
  const res = await route.GET({} as never);
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

describe("GET /api/models/defaults degrades the readiness sentence, not the registry", () => {
  beforeEach(() => {
    configResult.throws = null;
    configResult.value = { config: {}, error: null };
  });

  it("still serves the slots when the config file cannot be read", async () => {
    configResult.value = { config: {}, error: "EISDIR: illegal operation on a directory, read" };

    const res = await getDefaults();

    expect(res.status).toBe(200);
    expect((res.body.data as { defaults: unknown }).defaults).toEqual(DEFAULTS);
  });

  it("says nothing about readiness when the file that decides it is unreadable", async () => {
    // Not a guess in either direction. The file the gateway reads is the only
    // evidence for "what is the agent running", and we do not have it, so the
    // answer is the one every reader already understands as "not known yet".
    // Resolving from an empty config here would print "chosen but has not
    // reached the agent yet", which we cannot know and which sends the
    // operator to re-send a default that may already be live.
    configResult.value = { config: {}, error: "EACCES: permission denied, open" };

    const res = await getDefaults();

    expect((res.body.data as { modelReadiness: unknown }).modelReadiness).toBeNull();
  });

  it("survives a config read that throws outright", async () => {
    // The registry does not live in that file. Whatever the config layer does,
    // it may not be the reason this endpoint 500s.
    configResult.throws = Object.assign(new Error("EBUSY: resource busy or locked, open"), {
      code: "EBUSY",
    });

    const res = await getDefaults();

    expect(res.status).toBe(200);
    expect((res.body.data as { defaults: unknown }).defaults).toEqual(DEFAULTS);
    expect((res.body.data as { modelReadiness: unknown }).modelReadiness).toBeNull();
  });

  it("GREEN CONTROL: a readable config still resolves the readiness answer", async () => {
    configResult.value = {
      config: { model: { default: "MiniMax-M3", provider: "minimax" } },
      error: null,
    };

    const res = await getDefaults();

    expect(
      (res.body.data as { modelReadiness: { state: string; modelName: string } }).modelReadiness,
    ).toMatchObject({ state: "ready", modelName: "MiniMax-M3" });
  });
});
