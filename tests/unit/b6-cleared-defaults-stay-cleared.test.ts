/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports -- better-sqlite3's package root is not newable under the jest transform, and the hook harness loads react-dom after the DOM globals exist */

// ═══════════════════════════════════════════════════════════════
// B6 oracle, group defaults-and-diff, the D9 half (T-0100).
//
// Written before the product code moved. Contract section 2, "D9 cleared
// defaults stay cleared", lines (1) to (8):
//
//   (1) syncDefaultsToHermesConfig({ cleared: ['agent'] }) with no DB agent
//       default strips model.default/provider/base_url and keeps agent.*;
//   (2) { cleared: ['vision'] } removes auxiliary.vision and keeps the slot
//       that still has a default;
//   (3) a call with no options stays non-destructive;
//   (4) PUT /api/models/defaults hands `cleared` to finalizeRootConfigOnDisk
//       only when modelId is null;
//   (5) after the clear, a re-import cannot put the agent default back;
//   (6) DELETE /api/models/[id] clears every slot the row held, in one call;
//   (7) an unparseable config.yaml answers 200 with data.error naming the
//       parse failure, and the hook toasts it as an error, never 'Cleared';
//   (8) the-push-either-works harness: a cleared primary does not come back
//       through the agent-root Push, because finalize refreshed the row.
//
// THE DEFECT, in one line. syncDefaultsToHermesConfig only ever ADDS: the
// agent branch has no else and the auxiliary loop `continue`s past a cleared
// slot after spreading the old map, so config.yaml keeps naming the model the
// operator just cleared, Hermes keeps running it, and the next import (or the
// next agent-root Push, which assembles from agent_root.config_yaml) writes
// the default straight back into the database.
//
// Reds here are the implementation's to-do list. The GREEN CONTROLs pin what
// B6 keeps: a call that names no cleared slot strips nothing, so a CLI-set
// primary on an install with an empty registry survives every profile push.
//
// Type-tolerance: `syncDefaultsToHermesConfig` and `finalizeRootConfigOnDisk`
// take no argument today, so the option object goes through one loose cast
// each (`syncDefaults` / `finalize` below). Every runtime assertion is exactly
// what the contract says; only the compile-time view is loosened. Once B6
// lands, drop the two casts so the file re-tightens to the real signatures.
//
// Only the HOME is faked, in BOTH resolvers, for the reason the-push-either-
// works-or-says-what-happened.test.ts spells out: profile-push reads
// getHermesDefaultRoot from profile-paths, config-sync reads
// getActiveHermesPaths from agent-runtime, and mocking one leaves the other
// pointed at the operator's real Hermes home. The fuse test runs first.
// ═══════════════════════════════════════════════════════════════

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import * as yaml from "js-yaml";

const HOME_KEY = "__B6_HERMES_HOME__";

function currentHome(): string {
  return (global as Record<string, unknown>)[HOME_KEY] as string;
}

jest.mock("@/modules/hermes/lib/profile-paths", () => ({
  getHermesDefaultRoot: () => (global as Record<string, unknown>).__B6_HERMES_HOME__ as string,
  resolveProfileHermesHome: (slug: string) =>
    ((global as Record<string, unknown>).__B6_HERMES_HOME__ as string) + "/profiles/" + slug,
}));

jest.mock("@/modules/hermes/lib/agent-runtime", () => {
  const { buildHermesPathBundle } = jest.requireActual(
    "@/modules/hermes/lib/paths",
  ) as typeof import("@/modules/hermes/lib/paths");
  const home = () => (global as Record<string, unknown>).__B6_HERMES_HOME__ as string;
  return {
    getHermesDefaultRoot: () => home(),
    getActiveHermesPaths: () => buildHermesPathBundle(home()),
    getActiveHermesHome: () => home(),
  };
});

// A REAL in-memory database. The defect is a round trip between the
// model_defaults table, config.yaml and agent_root.config_yaml, and stubbing
// any one of the three would cut out part of the loop this file exists to close.
let testDb: import("better-sqlite3").Database | null = null;
jest.mock("@/lib/db", () => {
  const actualCrypto = jest.requireActual("crypto") as typeof import("crypto");
  return {
    getDb: () => testDb!,
    inTransaction: <T,>(fn: () => T) => testDb!.transaction(fn)(),
    uuid: () => actualCrypto.randomUUID(),
    now: () => new Date().toISOString(),
    ensureDb: () => undefined,
  };
});

// Neither the audit file nor the analytics table belongs in this oracle, and
// the real audit writer resolves PS_DATA_DIR.
jest.mock("@/lib/audit-log", () => ({ appendAuditLine: jest.fn() }));
jest.mock("@/lib/analytics/record-event", () => ({ recordEvent: jest.fn() }));

// The hook's transport. Everything else in api-fetch stays real because
// config-sync and the writers import toError / messageFromError from the same
// module.
const mockApiFetch = jest.fn();
jest.mock("@/lib/api-fetch", () => ({
  ...(jest.requireActual("@/lib/api-fetch") as Record<string, unknown>),
  apiFetch: (...a: unknown[]) => mockApiFetch(...a),
}));

import { NextRequest } from "next/server";

import { execBaselineSchema } from "../helpers/baseline-db";
import { createModel, getModelDefaults, setDefaultModel } from "@/lib/models-repository";
import { getAgentRoot, updateAgentRoot } from "@/lib/agent-root-repository";
import {
  finalizeRootConfigOnDisk,
  syncDefaultsToHermesConfig,
  type FinalizeRootConfigResult,
} from "@/modules/hermes/lib/config-sync";
import { pushRootToHermes } from "@/modules/hermes/lib/profile-push";
import type { TaskType } from "@/lib/models/task-types";
import { PUT as putDefaults, GET as getDefaults } from "@/app/api/models/defaults/route";
import { DELETE as deleteModelRoute } from "@/app/api/models/[id]/route";
import { POST as importModels } from "@/app/api/models/import/route";

// ── pre-B6 type shims (see header) ──────────────────────────────

interface ClearedOptions {
  cleared?: TaskType[];
}

const syncDefaults = syncDefaultsToHermesConfig as unknown as (
  options?: ClearedOptions,
) => { backupPath: string | null; error?: string };

const finalize = finalizeRootConfigOnDisk as unknown as (
  options?: ClearedOptions,
) => FinalizeRootConfigResult;

// ── fixtures ────────────────────────────────────────────────────

interface DiskConfig {
  model?: Record<string, unknown>;
  auxiliary?: Record<string, Record<string, unknown>>;
  agent?: Record<string, unknown>;
  [key: string]: unknown;
}

let home = "";

function configPath(): string {
  return join(home, "config.yaml");
}

function putOnDisk(doc: DiskConfig | string): void {
  writeFileSync(configPath(), typeof doc === "string" ? doc : yaml.dump(doc, { lineWidth: -1 }), "utf-8");
}

function readDisk(): DiskConfig {
  return (yaml.load(readFileSync(configPath(), "utf-8")) as DiskConfig | null) ?? {};
}

/** A primary the operator (or `hermes model`) set: everything the sync strips. */
const PRIMARY: DiskConfig = {
  model: {
    default: "anthropic/claude-sonnet-4",
    provider: "anthropic",
    base_url: "https://api.anthropic.com",
    api_key: "",
  },
  agent: { max_turns: 999 },
};

// Built by join so the literal carries no escape sequence.
const MALFORMED = ["agent:", "  max_turns: 100", "  max_turns: 200", ""].join("\n");

function jsonRequest(url: string, method: string, body?: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function readJson(res: Response): Promise<{ status: number; body: Record<string, unknown> }> {
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

interface DefaultsBody {
  defaults: Record<string, string | null>;
  error?: string | null;
}

async function clearViaRoute(taskType: TaskType): Promise<{ status: number; data: DefaultsBody }> {
  const res = await putDefaults(jsonRequest("http://localhost/api/models/defaults", "PUT", { taskType, modelId: null }));
  const { status, body } = await readJson(res);
  return { status, data: body.data as DefaultsBody };
}

async function setViaRoute(taskType: TaskType, modelId: string): Promise<{ status: number; data: DefaultsBody }> {
  const res = await putDefaults(jsonRequest("http://localhost/api/models/defaults", "PUT", { taskType, modelId }));
  const { status, body } = await readJson(res);
  return { status, data: body.data as DefaultsBody };
}

async function readDefaultsViaRoute(): Promise<Record<string, string | null>> {
  const res = await getDefaults(new NextRequest("http://localhost/api/models/defaults"));
  const { body } = await readJson(res);
  return (body.data as DefaultsBody).defaults;
}

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "b6-cleared-defaults-"));
  (global as Record<string, unknown>)[HOME_KEY] = home;

  const Database = require("better-sqlite3/lib/index.js") as typeof import("better-sqlite3");
  testDb = new (Database as unknown as new (path: string) => import("better-sqlite3").Database)(":memory:");
  testDb.pragma("foreign_keys = ON");
  execBaselineSchema(testDb);
  jest.clearAllMocks();
});

afterEach(() => {
  testDb?.close();
  testDb = null;
  if (home && existsSync(home)) rmSync(home, { recursive: true, force: true });
});

// ── the fuse ────────────────────────────────────────────────────

describe("FUSE: this file writes only where it is allowed to", () => {
  it("resolves BOTH Hermes roots inside the OS temp directory", () => {
    const { getHermesDefaultRoot } = require("@/modules/hermes/lib/profile-paths") as {
      getHermesDefaultRoot: () => string;
    };
    const { getActiveHermesPaths } = require("@/modules/hermes/lib/agent-runtime") as {
      getActiveHermesPaths: () => { root: string };
    };

    expect(getHermesDefaultRoot()).toContain("b6-cleared-defaults-");
    expect(getActiveHermesPaths().root).toContain("b6-cleared-defaults-");
    expect(currentHome().startsWith(tmpdir())).toBe(true);
  });
});

// ── (1) (2) (3): the sync itself ────────────────────────────────

describe("syncDefaultsToHermesConfig with { cleared }", () => {
  it("(1) strips model.default, provider and base_url when 'agent' is cleared, and keeps agent.max_turns", () => {
    putOnDisk(PRIMARY);

    const result = syncDefaults({ cleared: ["agent"] });

    expect(result.error).toBeUndefined();
    expect(result.backupPath).not.toBeNull();
    const cfg = readDisk();
    expect(cfg.model?.default).toBeUndefined();
    expect(cfg.model?.provider).toBeUndefined();
    expect(cfg.model?.base_url).toBeUndefined();
    expect(cfg.agent?.max_turns).toBe(999);
    expect(() => yaml.load(readFileSync(configPath(), "utf-8"))).not.toThrow();
  });

  it("(2) removes auxiliary.vision when cleared and keeps the compression slot that still has a default", () => {
    putOnDisk({
      auxiliary: {
        vision: { model: "openai/gpt-5", provider: "openai" },
        compression: { model: "openai/gpt-5", provider: "openai" },
      },
    });
    const fast = createModel({ name: "fast", provider: "openai", modelId: "openai/gpt-5" });
    setDefaultModel("compression", fast.id);

    syncDefaults({ cleared: ["vision"] });

    const cfg = readDisk();
    expect(cfg.auxiliary?.vision).toBeUndefined();
    expect(cfg.auxiliary?.compression?.model).toBe("openai/gpt-5");
  });

  it("(2) drops the auxiliary key entirely when the cleared slot was the last one", () => {
    putOnDisk({
      agent: { max_turns: 60 },
      auxiliary: { vision: { model: "openai/gpt-5", provider: "openai" } },
    });

    syncDefaults({ cleared: ["vision"] });

    const cfg = readDisk();
    expect(cfg.auxiliary).toBeUndefined();
    expect(cfg.agent?.max_turns).toBe(60);
  });

  it("GREEN CONTROL (3): a call with no options and no defaults leaves an existing model.default alone", () => {
    // The footgun the explicit list exists to avoid: finalizeRootConfigOnDisk
    // runs this sync after EVERY profile push, on installs whose registry may
    // be empty. Absent-in-DB must never mean strip-from-disk.
    putOnDisk(PRIMARY);

    syncDefaults();

    expect(readDisk().model?.default).toBe("anthropic/claude-sonnet-4");
  });

  it("(1)+(3) clearing 'agent' strips the primary and does not touch an auxiliary slot that was not named", () => {
    putOnDisk({
      ...PRIMARY,
      auxiliary: { vision: { model: "openai/gpt-5", provider: "openai" } },
    });

    syncDefaults({ cleared: ["agent"] });

    const cfg = readDisk();
    expect(cfg.model?.default).toBeUndefined();
    expect(cfg.auxiliary?.vision?.model).toBe("openai/gpt-5");
  });
});

// ── finalize carries `cleared` through and refreshes the row ────

describe("finalizeRootConfigOnDisk({ cleared })", () => {
  it("strips the cleared primary from disk AND from agent_root.config_yaml", () => {
    // The third door (critique-models, gap 1): the row is what the agent-root
    // Push assembles from. A clear that only fixes the disk is undone by the
    // next Push.
    const seeded = yaml.dump(PRIMARY, { lineWidth: -1 });
    putOnDisk(seeded);
    updateAgentRoot({ configYaml: seeded });

    const result = finalize({ cleared: ["agent"] });

    expect(result.error).toBeUndefined();
    expect(readDisk().model?.default).toBeUndefined();
    expect(getAgentRoot().configYaml).not.toContain("anthropic/claude-sonnet-4");
  });
});

// ── (8) the-push-either-works harness ───────────────────────────

describe("(8) a cleared primary does not come back through the agent-root Push", () => {
  it("pushRootToHermes() after the clear succeeds and writes no model.default", () => {
    const seeded = ["model:", "  default: old/model", "  provider: openai", ""].join("\n");
    putOnDisk(seeded);
    updateAgentRoot({ configYaml: seeded });

    finalize({ cleared: ["agent"] });
    const pushed = pushRootToHermes();

    expect(pushed.error).toBeNull();
    expect(pushed.success).toBe(true);
    expect(readDisk().model?.default).toBeUndefined();
    expect(readFileSync(configPath(), "utf-8")).not.toContain("old/model");
  });

  it("the same through the route the operator actually uses", async () => {
    const seeded = ["model:", "  default: old/model", "  provider: openai", ""].join("\n");
    putOnDisk(seeded);
    updateAgentRoot({ configYaml: seeded });

    const cleared = await clearViaRoute("agent");
    expect(cleared.status).toBe(200);
    const pushed = pushRootToHermes();

    expect(pushed.success).toBe(true);
    expect(readDisk().model?.default).toBeUndefined();
  });

  it("GREEN CONTROL: a profile push with an empty registry keeps a CLI-set primary", () => {
    // What the explicit `cleared` list buys over an unconditional strip.
    const seeded = ["model:", "  default: old/model", "  provider: openai", ""].join("\n");
    putOnDisk(seeded);
    updateAgentRoot({ configYaml: seeded });

    const pushed = pushRootToHermes();

    expect(pushed.success).toBe(true);
    expect(readDisk().model?.default).toBe("old/model");
  });
});

// ── (4) (5) (6) (7): the routes against the real sync ───────────

describe("PUT /api/models/defaults against the real sync", () => {
  it("(4) clearing the agent slot answers 200 with defaults.agent null and error null, and the disk loses model.default", async () => {
    const m = createModel({
      name: "Sonnet",
      provider: "anthropic",
      modelId: "anthropic/claude-sonnet-4",
      baseUrl: "https://api.anthropic.com",
    });
    setDefaultModel("agent", m.id);
    syncDefaults();
    expect(readDisk().model?.default).toBe("anthropic/claude-sonnet-4");

    const res = await clearViaRoute("agent");

    expect(res.status).toBe(200);
    expect(res.data.defaults.agent).toBeNull();
    expect(res.data.error).toBeNull();
    expect(readDisk().model?.default).toBeUndefined();
  });

  it("GREEN CONTROL (4): setting one slot never strips another", async () => {
    // A modelId in the body means no `cleared` entry, so the CLI-set primary
    // stays while auxiliary.vision is written.
    putOnDisk({ model: { default: "old/model", provider: "openai" } });
    const fast = createModel({ name: "fast", provider: "openai", modelId: "openai/gpt-5" });

    const res = await setViaRoute("vision", fast.id);

    expect(res.status).toBe(200);
    const cfg = readDisk();
    expect(cfg.model?.default).toBe("old/model");
    expect(cfg.auxiliary?.vision?.model).toBe("openai/gpt-5");
  });

  it("(5) a re-import after the clear cannot put the agent default back", async () => {
    const m = createModel({
      name: "Sonnet",
      provider: "anthropic",
      modelId: "anthropic/claude-sonnet-4",
      baseUrl: "https://api.anthropic.com",
    });
    setDefaultModel("agent", m.id);
    syncDefaults();

    await clearViaRoute("agent");
    const imported = await importModels(new NextRequest("http://localhost/api/models/import", { method: "POST" }));
    expect(imported.status).toBe(200);

    expect(getModelDefaults().agent).toBeNull();
    expect((await readDefaultsViaRoute()).agent).toBeNull();
  });

  it("(7) an unparseable config.yaml answers 200 with data.error naming the parse failure, and the DB change is saved", async () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    try {
      const m = createModel({ name: "Sonnet", provider: "anthropic", modelId: "anthropic/claude-sonnet-4" });
      setDefaultModel("agent", m.id);
      putOnDisk(MALFORMED);

      const res = await clearViaRoute("agent");

      expect(res.status).toBe(200);
      expect(res.data.defaults.agent).toBeNull();
      expect(res.data.error).toEqual(expect.stringContaining("did not parse"));
      expect(getModelDefaults().agent).toBeNull();
      // Refuse-and-report, as before: the corrupt file is left byte-identical.
      expect(readFileSync(configPath(), "utf-8")).toBe(MALFORMED);
    } finally {
      spy.mockRestore();
    }
  });
});

describe("DELETE /api/models/[id] against the real sync", () => {
  async function deleteViaRoute(id: string): Promise<number> {
    const res = await deleteModelRoute(
      new NextRequest(`http://localhost/api/models/${encodeURIComponent(id)}`, { method: "DELETE" }),
      { params: Promise.resolve({ id }) },
    );
    return res.status;
  }

  it("(6) deleting the model that holds agent AND vision removes model.default and auxiliary.vision in one request", async () => {
    const m = createModel({
      name: "Sonnet",
      provider: "anthropic",
      modelId: "anthropic/claude-sonnet-4",
      baseUrl: "https://api.anthropic.com",
    });
    setDefaultModel("agent", m.id);
    setDefaultModel("vision", m.id);
    syncDefaults();
    const before = readDisk();
    expect(before.model?.default).toBe("anthropic/claude-sonnet-4");
    expect(before.auxiliary?.vision?.model).toBe("anthropic/claude-sonnet-4");

    const status = await deleteViaRoute(m.id);

    expect(status).toBe(200);
    const after = readDisk();
    expect(after.model?.default).toBeUndefined();
    expect(after.auxiliary?.vision).toBeUndefined();
  });

  it("GREEN CONTROL (6): deleting a model that holds no slot leaves a CLI-set primary alone", async () => {
    putOnDisk({ model: { default: "old/model", provider: "openai" } });
    const spare = createModel({ name: "spare", provider: "openai", modelId: "openai/gpt-5" });

    const status = await deleteViaRoute(spare.id);

    expect(status).toBe(200);
    expect(readDisk().model?.default).toBe("old/model");
  });
});

// ── (4) (6) (7): the routes against the models-api mock set ─────

describe("the routes hand `cleared` to finalizeRootConfigOnDisk (config-sync doubled)", () => {
  // models-api.test.ts doubles @/modules/hermes/lib/config-sync with a fixed
  // export list; the contract adds finalizeRootConfigOnDisk to it. This block
  // loads the two routes in an isolated registry so the double reaches them
  // while every other test in this file keeps the real sync. The repository
  // stays real (same in-memory database), so the DELETE snapshot reads real
  // rows rather than a stub.
  const mockFinalize = jest.fn();
  const mockSyncDefaults = jest.fn(() => ({ backupPath: null }));

  type DefaultsRoute = typeof import("@/app/api/models/defaults/route");
  type IdRoute = typeof import("@/app/api/models/[id]/route");
  let isolated: { defaults: DefaultsRoute; byId: IdRoute };

  beforeEach(() => {
    mockFinalize.mockReset();
    mockFinalize.mockReturnValue({ appliedModelDefaults: false, backupPath: null });
    mockSyncDefaults.mockClear();
    jest.isolateModules(() => {
      jest.doMock("@/modules/hermes/lib/config-sync", () => ({
        syncDefaultsToHermesConfig: (...a: unknown[]) => mockSyncDefaults(...(a as [])),
        finalizeRootConfigOnDisk: (...a: unknown[]) => mockFinalize(...a),
        syncCredentialToHermesEnv: jest.fn(() => ({ backupPath: null })),
        removeCredentialFromHermesEnv: jest.fn(() => ({ backupPath: null })),
        syncSingleCredentialToHermesEnv: jest.fn(() => ({ backupPath: null })),
        syncSingleModelToHermesConfig: jest.fn(() => ({ backupPath: null })),
        syncFallbacksToHermesConfig: jest.fn(() => ({ backupPath: null })),
      }));
      isolated = {
        defaults: require("@/app/api/models/defaults/route") as DefaultsRoute,
        byId: require("@/app/api/models/[id]/route") as IdRoute,
      };
    });
  });

  afterAll(() => {
    jest.dontMock("@/modules/hermes/lib/config-sync");
  });

  function clearedArg(): TaskType[] | undefined {
    const arg = mockFinalize.mock.calls[0]?.[0] as ClearedOptions | undefined;
    return arg?.cleared;
  }

  it("(4) PUT { agent, null } calls finalize once with cleared containing 'agent'", async () => {
    const res = await isolated.defaults.PUT(
      jsonRequest("http://localhost/api/models/defaults", "PUT", { taskType: "agent", modelId: null }),
    );

    expect(res.status).toBe(200);
    expect(mockFinalize).toHaveBeenCalledTimes(1);
    expect(clearedArg()).toContain("agent");
    expect(((await res.json()) as { data: DefaultsBody }).data.defaults.agent).toBeNull();
  });

  it("(4) PUT { agent, m_1 } calls finalize with no cleared entry for 'agent'", async () => {
    const m = createModel({ name: "Sonnet", provider: "anthropic", modelId: "anthropic/claude-sonnet-4" });

    const res = await isolated.defaults.PUT(
      jsonRequest("http://localhost/api/models/defaults", "PUT", { taskType: "agent", modelId: m.id }),
    );

    expect(res.status).toBe(200);
    expect(mockFinalize).toHaveBeenCalledTimes(1);
    expect(clearedArg() ?? []).not.toContain("agent");
  });

  it("(7) a refused yaml write is reported in data.error, not hidden behind a 200 that says nothing", async () => {
    mockFinalize.mockReturnValue({
      appliedModelDefaults: false,
      backupPath: null,
      error: "config.yaml did not parse (duplicated mapping key) — defaults not applied. Repair the YAML by hand, then Pull from Hermes.",
    });

    const res = await isolated.defaults.PUT(
      jsonRequest("http://localhost/api/models/defaults", "PUT", { taskType: "agent", modelId: null }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: DefaultsBody };
    expect(body.data.error).toEqual(expect.stringContaining("did not parse"));
    expect(body.data.defaults.agent).toBeNull();
  });

  it("(6) DELETE snapshots the defaults BEFORE the row goes and clears every slot it held", async () => {
    const m = createModel({ name: "Sonnet", provider: "anthropic", modelId: "anthropic/claude-sonnet-4" });
    setDefaultModel("agent", m.id);
    setDefaultModel("vision", m.id);

    const res = await isolated.byId.DELETE(
      new NextRequest(`http://localhost/api/models/${m.id}`, { method: "DELETE" }),
      { params: Promise.resolve({ id: m.id }) },
    );

    expect(res.status).toBe(200);
    expect(mockFinalize).toHaveBeenCalledTimes(1);
    const cleared = clearedArg() ?? [];
    expect(cleared).toContain("agent");
    expect(cleared).toContain("vision");
    expect(cleared).not.toContain("compression");
  });

  it("(6) DELETE of a model holding no slot hands finalize an empty cleared list", async () => {
    const spare = createModel({ name: "spare", provider: "openai", modelId: "openai/gpt-5" });

    const res = await isolated.byId.DELETE(
      new NextRequest(`http://localhost/api/models/${spare.id}`, { method: "DELETE" }),
      { params: Promise.resolve({ id: spare.id }) },
    );

    expect(res.status).toBe(200);
    expect(mockFinalize).toHaveBeenCalledTimes(1);
    expect(clearedArg() ?? []).toEqual([]);
  });
});

// ── (7) the hook reads the PUT body ─────────────────────────────

describe("useModelActions.handleSetDefault toasts data.error", () => {
  // This file is a node suite because the rest of it needs a real database and
  // a real filesystem. The hook needs a DOM for react-dom to mount into, so a
  // jsdom window is installed on the global for this block only and removed
  // afterwards; react-dom/client and the hook are loaded AFTER the globals
  // exist, because react-dom decides at module load whether it has a DOM.
  type HookModule = typeof import("@/hooks/useModelActions");
  type HookResult = ReturnType<HookModule["useModelActions"]>;

  let React: typeof import("react");
  let createRoot: typeof import("react-dom/client").createRoot;
  let useModelActions: HookModule["useModelActions"];
  let restoreGlobals: () => void = () => undefined;

  beforeAll(() => {
    const { JSDOM } = require("jsdom") as {
      JSDOM: new (html: string, opts: { url: string }) => {
        window: Record<string, unknown> & { close(): void };
      };
    };
    const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
    const g = globalThis as unknown as Record<string, unknown>;
    const names = ["window", "document"] as const;
    const saved = names.map((n) => [n, Object.getOwnPropertyDescriptor(globalThis, n)] as const);
    Object.defineProperty(globalThis, "window", { value: dom.window, configurable: true, writable: true });
    Object.defineProperty(globalThis, "document", { value: dom.window.document, configurable: true, writable: true });
    const hadActFlag = "IS_REACT_ACT_ENVIRONMENT" in g;
    g.IS_REACT_ACT_ENVIRONMENT = true;

    React = require("react") as typeof import("react");
    createRoot = (require("react-dom/client") as typeof import("react-dom/client")).createRoot;
    useModelActions = (require("@/hooks/useModelActions") as HookModule).useModelActions;

    restoreGlobals = () => {
      for (const [n, d] of saved) {
        if (d) Object.defineProperty(globalThis, n, d);
        else delete g[n];
      }
      if (!hadActFlag) delete g.IS_REACT_ACT_ENVIRONMENT;
      dom.window.close();
    };
  });

  afterAll(() => restoreGlobals());

  function mountHook() {
    const showToast = jest.fn();
    const loadAll = jest.fn(async () => undefined);
    // Named ...Ref so react-hooks/immutability reads the assignment below as
    // the ref-cell write it is, not as a write to an outer variable.
    const hookRef: { current: HookResult | null } = { current: null };
    const container = document.createElement("div");
    const root = createRoot(container);
    function Probe(): null {
      // eslint-disable-next-line react-hooks/immutability -- the probe's whole job is to hand the hook's return value back to the test; there is no state to derive it from and an effect would run a tick late
      hookRef.current = useModelActions({ loadAll, setDefaults: jest.fn(), showToast });
      return null;
    }
    React.act(() => {
      root.render(React.createElement(Probe));
    });
    return {
      showToast,
      loadAll,
      hook: () => hookRef.current!,
      unmount: () => React.act(() => root.unmount()),
    };
  }

  it("(7) a 200 whose body carries error toasts that text as an error, never 'Cleared default'", async () => {
    mockApiFetch.mockResolvedValue({
      data: {
        defaults: { agent: null },
        error: "config.yaml did not parse (duplicated mapping key) — defaults not applied. Repair the YAML by hand, then Pull from Hermes.",
      },
    });
    const { showToast, loadAll, hook, unmount } = mountHook();

    await React.act(async () => {
      await hook().handleSetDefault("agent", null);
    });

    expect(showToast).toHaveBeenCalledWith(expect.stringContaining("did not parse"), "error");
    expect(showToast).not.toHaveBeenCalledWith(expect.stringMatching(/cleared default/i), expect.anything());
    expect(loadAll).toHaveBeenCalled();
    unmount();
  });

  it("GREEN CONTROL (7): a body with error null still says 'Cleared default for agent'", async () => {
    mockApiFetch.mockResolvedValue({ data: { defaults: { agent: null }, error: null } });
    const { showToast, hook, unmount } = mountHook();

    await React.act(async () => {
      await hook().handleSetDefault("agent", null);
    });

    expect(showToast).toHaveBeenCalledWith("Cleared default for agent", "success");
    unmount();
  });

  it("GREEN CONTROL (7): setting a default still says 'Default updated for vision'", async () => {
    mockApiFetch.mockResolvedValue({ data: { defaults: { vision: "m_1" } } });
    const { showToast, hook, unmount } = mountHook();

    await React.act(async () => {
      await hook().handleSetDefault("vision", "m_1");
    });

    expect(showToast).toHaveBeenCalledWith("Default updated for vision", "success");
    unmount();
  });
});
