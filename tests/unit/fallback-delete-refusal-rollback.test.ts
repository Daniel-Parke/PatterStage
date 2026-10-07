/** @jest-environment node */

import type { NextRequest } from "next/server";
import type { RealDb } from "../helpers/baseline-db";

const fs = jest.requireActual<typeof import("fs")>("fs");
const path = jest.requireActual<typeof import("path")>("path");
const yaml = jest.requireActual<typeof import("js-yaml")>("js-yaml");
const proofRoot = path.resolve("tmp/t0208-fallback-oracle");
fs.mkdirSync(proofRoot, { recursive: true });
const world = fs.mkdtempSync(path.join(proofRoot, "world-"));
const environment = {
  PS_DATA_DIR: path.join(world, "data"),
  PS_SCRIPTS_DIR: path.join(world, "scripts"),
  PS_HARDWARE_LOG_DIR: path.join(world, "logs"),
  HERMES_HOME: path.join(world, "default-hermes"),
  AGENT_HOME: path.join(world, "default-hermes"),
};
const savedEnvironment = Object.fromEntries(Object.keys(environment).map((key) => [key, process.env[key]]));
Object.assign(process.env, environment);

let database: RealDb | null = null;
let ownedRoot: string;
jest.mock("@/lib/db", () => require("../helpers/baseline-db").dbSingletonMock(() => database));
jest.mock("@/modules/hermes/lib/agent-runtime", () => ({
  getActiveHermesPaths: () => jest.requireActual("@/modules/hermes/lib/paths").buildHermesPathBundle(ownedRoot),
}));

// Load application modules only after all filesystem destinations are owned.
const { openBaselineDb } = jest.requireActual<typeof import("../helpers/baseline-db")>("../helpers/baseline-db");
const { addFallbackEntry, updateFallbackConfigBatch } = jest.requireActual<typeof import("@/lib/models/fallbacks-repository")>("@/lib/models/fallbacks-repository");
const { DELETE } = jest.requireActual<typeof import("@/app/api/models/fallbacks/[id]/route")>("@/app/api/models/fallbacks/[id]/route");
const auditPath = path.join(environment.PS_DATA_DIR, "audit", "ps-audit.log");
const auditBefore = '{"action":"oracle.fixture","resource":"synthetic","ok":true}\n';
let configBefore: Buffer;
let ids: string[];

function rows(table: "model_fallbacks" | "models" | "credentials" | "fallback_config" | "meta") {
  return database!.prepare(`SELECT * FROM ${table} ORDER BY 1`).all();
}

function snapshot() {
  return {
    fallbacks: rows("model_fallbacks"), models: rows("models"), credentials: rows("credentials"),
    settings: rows("fallback_config"), meta: rows("meta"),
    yaml: fs.readFileSync(path.join(ownedRoot, "config.yaml")),
    audit: fs.readFileSync(auditPath, "utf8"),
    staged: fs.readdirSync(ownedRoot).filter((name) => name.includes(".tmp-")),
  };
}

async function remove(id: string) {
  // The real response guard explicitly supports partial direct-handler requests.
  const request = { method: "DELETE", headers: new Headers() } as NextRequest;
  return DELETE(request, { params: Promise.resolve({ id }) });
}

function seedChain(count: number) {
  updateFallbackConfigBatch({ apiMaxRetries: 3, restorePrimaryOnFallback: false, fallbackNotification: false });
  ids = Array.from({ length: count }, (_, index) => addFallbackEntry({
    modelId: null, position: index + 1, modelName: `Synthetic ${index + 1}`,
    provider: "openai", modelIdString: `oracle-model-${index + 1}`,
  }).id);
  configBefore = Buffer.from(yaml.dump({
    model: { provider: "openai", default: "oracle-primary" },
    agent: { max_turns: 17, api_max_retries: 3, restore_primary_on_fallback: false, fallback_notification: false },
    fallback_providers: ids.map((_, index) => ({ provider: "openai", model: `oracle-model-${index + 1}` })),
  }));
  fs.writeFileSync(path.join(ownedRoot, "config.yaml"), configBefore);
}

beforeEach(() => {
  ownedRoot = fs.mkdtempSync(path.join(world, "hermes-"));
  database = openBaselineDb();
  database.prepare("INSERT INTO credentials (id, label, provider, api_key) VALUES (?, ?, ?, ?)")
    .run("oracle-credential", "Synthetic unrelated credential", "openai", "not-a-real-key");
  database.prepare("INSERT INTO models (id, name, provider, model_id, credentials_id) VALUES (?, ?, ?, ?, ?)")
    .run("oracle-unrelated", "Synthetic unrelated model", "openai", "oracle-unrelated-model", "oracle-credential");
  database.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)").run("config.cached_json", '{"fixture":true}');
  database.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)").run("config.cached_at", "2026-10-07T00:00:00.000Z");
  fs.mkdirSync(path.dirname(auditPath), { recursive: true });
  fs.writeFileSync(auditPath, auditBefore);
});

afterEach(() => {
  jest.restoreAllMocks();
  database?.close();
  database = null;
});

afterAll(() => {
  for (const key of Object.keys(environment)) {
    if (savedEnvironment[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnvironment[key];
  }
});

describe("T-0208 real SQLite DELETE refusal preservation", () => {
  it.each([
    ["last enabled fallback survives owned EPERM replacement refusal", 1, 0],
    ["middle fallback and later positions survive owned EPERM replacement refusal", 3, 1],
  ])("%s", async (_name, count, index) => {
    seedChain(count);
    const before = snapshot();
    const destination = path.resolve(ownedRoot, "config.yaml");
    const originalRename = fs.renameSync;
    let refusals = 0;
    const rename = jest.spyOn(fs, "renameSync").mockImplementation((from, to) => {
      if (path.resolve(String(to)) !== destination) return originalRename(from, to);
      expect(path.dirname(path.resolve(String(from)))).toBe(ownedRoot);
      expect(fs.existsSync(from)).toBe(true);
      refusals += 1;
      throw Object.assign(new Error("EPERM: oracle owned config replacement refused"), { code: "EPERM" });
    });
    try {
      const response = await remove(ids[index]);
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: "Failed to delete fallback" });
      expect(refusals).toBe(1);
      // One aggregate matcher executes every preservation observation even on red.
      const after = snapshot();
      fs.writeFileSync(path.join(world, `refusal-${count}.json`), JSON.stringify({ name: _name, refusals, before, after }, null, 2));
      expect(after).toEqual(before);
    } finally {
      rename.mockRestore();
    }
  });

  it("successful middle DELETE closes positions, synchronises YAML and audits once", async () => {
    seedChain(3);
    const before = snapshot();
    const response = await remove(ids[1]);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { deleted: true } });
    const remaining = database!.prepare("SELECT id, position FROM model_fallbacks ORDER BY position").all();
    expect(remaining).toEqual([{ id: ids[0], position: 1 }, { id: ids[2], position: 2 }]);
    const config = yaml.load(fs.readFileSync(path.join(ownedRoot, "config.yaml"), "utf8")) as Record<string, unknown>;
    expect(config.fallback_providers).toEqual([
      { provider: "openai", model: "oracle-model-1" }, { provider: "openai", model: "oracle-model-3" },
    ]);
    expect(config.agent).toEqual({ max_turns: 17, api_max_retries: 3, restore_primary_on_fallback: false, fallback_notification: false });
    const after = snapshot();
    expect(after.models).toEqual(before.models);
    expect(after.credentials).toEqual(before.credentials);
    expect(after.settings).toEqual(before.settings);
    expect(after.meta).toEqual(before.meta.filter((row) => !["config.cached_json", "config.cached_at"].includes((row as { key: string }).key)));
    expect(after.staged).toEqual([]);
    const audit = after.audit.slice(auditBefore.length).trim().split("\n").map((line) => JSON.parse(line));
    expect(audit).toEqual([expect.objectContaining({ action: "fallback.delete", resource: ids[1], ok: true })]);
  });

  it("missing DELETE returns 404 without filesystem writes, audit or database changes", async () => {
    seedChain(3);
    const before = snapshot();
    const write = jest.spyOn(fs, "writeFileSync");
    const rename = jest.spyOn(fs, "renameSync");
    const copy = jest.spyOn(fs, "copyFileSync");
    const append = jest.spyOn(fs, "appendFileSync");
    const mkdir = jest.spyOn(fs, "mkdirSync");
    const unlink = jest.spyOn(fs, "unlinkSync");
    try {
      const response = await remove("oracle-absent");
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: "Fallback entry not found" });
      for (const operation of [write, rename, copy, append, mkdir, unlink]) expect(operation).not.toHaveBeenCalled();
      expect(snapshot()).toEqual(before);
    } finally {
      for (const operation of [write, rename, copy, append, mkdir, unlink]) operation.mockRestore();
    }
  });
});
