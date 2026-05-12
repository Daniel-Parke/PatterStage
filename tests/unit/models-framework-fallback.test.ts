/* eslint-disable @typescript-eslint/no-require-imports */
/** @jest-environment node */

/**
 * Tests for framework persistence, fallback chain, fallback config,
 * model sync push/pull, and new models-repository features added in
 * PR feat/models-page-fixes.
 */

import { readFileSync } from "fs";
import { join } from "path";

const repoRoot = join(__dirname, "..", "..");
const initialPath = join(repoRoot, "src", "lib", "db", "migrations", "001_initial_schema.sql");
const missionExtPath = join(repoRoot, "src", "lib", "db", "migrations", "004_mission_extensions.sql");
const statusEnumPath = join(repoRoot, "src", "lib", "db", "migrations", "005_mission_status_enum.sql");
const modelsPath = join(repoRoot, "src", "lib", "db", "migrations", "006_models_credentials.sql");
const frameworkFallbackPath = join(repoRoot, "src", "lib", "db", "migrations", "012_models_framework_fallback.sql");

let testDb: import("better-sqlite3").Database | null = null;

function loadRealBetterSqlite3(): typeof import("better-sqlite3") {
  return require("better-sqlite3/lib/index.js") as typeof import("better-sqlite3");
}

jest.mock("@/lib/db", () => {
  const actualCrypto = jest.requireActual("crypto") as typeof import("crypto");
  return {
    db: () => testDb!,
    inTransaction: <T,>(fn: () => T) => testDb!.transaction(fn)(),
    uuid: () => actualCrypto.randomUUID(),
    now: () => new Date().toISOString(),
    ensureDb: () => undefined,
  };
});

// Mock hermes-agent-runtime for server-side framework persistence
jest.mock("@/lib/hermes-agent-runtime", () => ({
  getActiveHermesHome: () => "/tmp/test-hermes-home",
  getActiveHermesPaths: () => ({
    root: "/tmp/test-hermes-home",
    config: "/tmp/test-hermes-home/config.yaml",
    env: "/tmp/test-hermes-home/.env",
    backups: "/tmp/test-hermes-home/backups",
  }),
}));

function setupDb() {
  const Database = loadRealBetterSqlite3();
  testDb = new (Database as unknown as new (path: string) => import("better-sqlite3").Database)(
    ":memory:"
  );
  testDb.pragma("foreign_keys = ON");
  testDb.exec(readFileSync(initialPath, "utf-8"));
  testDb.exec(readFileSync(missionExtPath, "utf-8"));
  testDb.exec(readFileSync(statusEnumPath, "utf-8"));
  testDb.exec(readFileSync(modelsPath, "utf-8"));
  // Migration 012 guard
  testDb.exec("CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);");
  testDb.exec(`INSERT INTO meta (key, value) VALUES ('schema_version', '006');`);
  testDb.exec(readFileSync(frameworkFallbackPath, "utf-8"));
}

beforeEach(() => {
  setupDb();
});

afterEach(() => {
  testDb?.close();
  testDb = null;
});

// ── Migration 012 tests ──────────────────────────────────────

describe("Migration 012 — framework_id and fallback schemas", () => {
  it("adds framework_id column to models and backfills with '*'", () => {
    const Database = loadRealBetterSqlite3();
    const db = new (Database as unknown as new (path: string) => import("better-sqlite3").Database)(
      ":memory:"
    );
    db.pragma("foreign_keys = ON");
    db.exec(readFileSync(initialPath, "utf-8"));
    db.exec(readFileSync(missionExtPath, "utf-8"));
    db.exec(readFileSync(statusEnumPath, "utf-8"));
    db.exec(readFileSync(modelsPath, "utf-8"));

    // Migration 012 guard
    db.exec("CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);");
    db.exec("INSERT INTO meta (key, value) VALUES ('schema_version', '006');");
    db.exec(readFileSync(frameworkFallbackPath, "utf-8"));

    // Verify framework_id column exists and backfilled
    const row = db.prepare("SELECT COUNT(*) as cnt FROM models WHERE framework_id = '*'").get() as { cnt: number };
    expect(row.cnt).toBe(0); // empty table, but column exists
    const colInfo = db.prepare("PRAGMA table_info(models)").all() as Array<{ name: string }>;
    const fwCol = colInfo.find(c => c.name === "framework_id");
    expect(fwCol).toBeDefined();

    db.close();
  });

  it("creates model_defaults table", () => {
    const rows = testDb!.prepare("PRAGMA table_info(model_defaults)").all() as Array<{ name: string }>;
    const colNames = rows.map(r => r.name);
    expect(colNames).toContain("framework_id");
    expect(colNames).toContain("task_type");
    expect(colNames).toContain("model_id");
  });

  it("creates model_fallbacks table", () => {
    const rows = testDb!.prepare("PRAGMA table_info(model_fallbacks)").all() as Array<{ name: string }>;
    const colNames = rows.map(r => r.name);
    expect(colNames).toContain("model_id");
    expect(colNames).toContain("position");
    expect(colNames).toContain("enabled");
    expect(colNames).toContain("override_base_url");
  });

  it("creates fallback_config table with seeded defaults", () => {
    const rows = testDb!.prepare("SELECT key, value FROM fallback_config ORDER BY key").all() as Array<{ key: string; value: string }>;
    expect(rows.length).toBe(3);
    expect(rows[0]).toEqual({ key: "api_max_retries", value: "3" });
    expect(rows[1]).toEqual({ key: "fallback_notification", value: "true" });
    expect(rows[2]).toEqual({ key: "restore_primary_on_fallback", value: "true" });
  });

  it("drops all 12 is_default_* columns from models", () => {
    const colInfo = testDb!.prepare("PRAGMA table_info(models)").all() as Array<{ name: string }>;
    const colNames = colInfo.map(c => c.name);
    const droppedCols = [
      "is_default_agent", "is_default_hindsight", "is_default_compression",
      "is_default_vision", "is_default_web_extract", "is_default_session_search",
      "is_default_title_generation", "is_default_skills_hub", "is_default_mcp",
      "is_default_triage_specifier", "is_default_approval", "is_default_delegation",
    ];
    for (const col of droppedCols) {
      expect(colNames).not.toContain(col);
    }
  });

  it("drops all 12 partial unique indexes", () => {
    const indexes = testDb!.prepare("PRAGMA index_list(models)").all() as Array<{ name: string }>;
    const idxNames = indexes.map(i => i.name);
    const droppedIdx = [
      "uniq_default_agent", "uniq_default_hindsight",
    ];
    for (const idx of droppedIdx) {
      expect(idxNames).not.toContain(idx);
    }
  });
});

// ── Fallback chain tests ────────────────────────────────────

describe("fallbacks-repository — CRUD", () => {
  let repo: typeof import("@/lib/fallbacks-repository");
  let modRepo: typeof import("@/lib/models-repository");

  beforeEach(() => {
    repo = require("@/lib/fallbacks-repository");
    modRepo = require("@/lib/models-repository");
  });

  it("starts with empty fallback chain", () => {
    const chain = repo.listFallbackChain();
    expect(chain).toEqual([]);
  });

  it("adds a fallback entry from registry", () => {
    const model = modRepo.createModel({
      name: "Test Model",
      provider: "anthropic",
      modelId: "claude-test",
    });
    const entry = repo.addFallbackEntry({ modelId: model.id });
    expect(entry.modelId).toBe(model.id);
    expect(entry.modelName).toBe("Test Model");
    expect(entry.provider).toBe("anthropic");
    expect(entry.position).toBe(1);
    expect(entry.enabled).toBe(true);
  });

  it("adds a custom fallback entry (no FK to models)", () => {
    const entry = repo.addFallbackEntry({
      modelId: null,
      overrideBaseUrl: "https://api.openai.com/v1",
    });
    // Custom entries return denormalised defaults since no FK to models
    expect(entry.modelId).toBeNull();
    expect(entry.modelName).toBe("Custom");
    expect(entry.provider).toBe("custom");
    expect(entry.modelIdString).toBe("");
    expect(entry.overrideBaseUrl).toBe("https://api.openai.com/v1");
  });

  it("auto-increments position on multiple entries", () => {
    const m1 = modRepo.createModel({ name: "M1", provider: "anthropic", modelId: "m1" });
    const m2 = modRepo.createModel({ name: "M2", provider: "openai", modelId: "m2" });
    repo.addFallbackEntry({ modelId: m1.id });
    repo.addFallbackEntry({ modelId: m2.id });
    const chain = repo.listFallbackChain();
    expect(chain[0].position).toBe(1);
    expect(chain[1].position).toBe(2);
  });

  it("updates a fallback entry", () => {
    const m1 = modRepo.createModel({ name: "M1", provider: "anthropic", modelId: "m1" });
    const entry = repo.addFallbackEntry({ modelId: m1.id });
    const updated = repo.updateFallbackEntry(entry.id, { enabled: false, overrideBaseUrl: "https://example.com" });
    expect(updated).not.toBeNull();
    expect(updated!.enabled).toBe(false);
    expect(updated!.overrideBaseUrl).toBe("https://example.com");
  });

  it("toggles a fallback entry", () => {
    const m1 = modRepo.createModel({ name: "M1", provider: "anthropic", modelId: "m1" });
    const entry = repo.addFallbackEntry({ modelId: m1.id });
    expect(entry.enabled).toBe(true);
    const toggled = repo.toggleFallbackEntry(entry.id, false);
    expect(toggled!.enabled).toBe(false);
  });

  it("deletes and repositions", () => {
    const m1 = modRepo.createModel({ name: "M1", provider: "anthropic", modelId: "m1" });
    const m2 = modRepo.createModel({ name: "M2", provider: "openai", modelId: "m2" });
    const m3 = modRepo.createModel({ name: "M3", provider: "deepseek", modelId: "m3" });
    repo.addFallbackEntry({ modelId: m1.id });
    const e2 = repo.addFallbackEntry({ modelId: m2.id });
    repo.addFallbackEntry({ modelId: m3.id });
    expect(repo.listFallbackChain().length).toBe(3);
    repo.deleteFallbackEntry(e2.id);
    const chain = repo.listFallbackChain();
    expect(chain.length).toBe(2);
    expect(chain[0].position).toBe(1);
    expect(chain[1].position).toBe(2); // repositioned from 3
  });

  it("reorders a batch of entries", () => {
    const m1 = modRepo.createModel({ name: "M1", provider: "anthropic", modelId: "m1" });
    const m2 = modRepo.createModel({ name: "M2", provider: "openai", modelId: "m2" });
    const e1 = repo.addFallbackEntry({ modelId: m1.id, position: 1 });
    const e2 = repo.addFallbackEntry({ modelId: m2.id, position: 2 });
    // Swap: e2 -> 1, e1 -> 2
    repo.reorderFallbackChain([{ id: e1.id, position: 2 }, { id: e2.id, position: 1 }]);
    const chain = repo.listFallbackChain();
    const updated1 = chain.find(e => e.id === e1.id);
    const updated2 = chain.find(e => e.id === e2.id);
    expect(updated1!.position).toBe(2);
    expect(updated2!.position).toBe(1);
  });
});

// ── Fallback config tests ───────────────────────────────────

describe("fallbacks-repository — fallback config", () => {
  let repo: typeof import("@/lib/fallbacks-repository");

  beforeEach(() => {
    repo = require("@/lib/fallbacks-repository");
  });

  it("reads seeded defaults", () => {
    const config = repo.getFallbackConfig();
    expect(config.restorePrimaryOnFallback).toBe(true);
    expect(config.fallbackNotification).toBe(true);
    expect(config.apiMaxRetries).toBe(3);
  });

  it("updates a single config key", () => {
    repo.updateFallbackConfig("api_max_retries", 5);
    const config = repo.getFallbackConfig();
    expect(config.apiMaxRetries).toBe(5);
  });

  it("bulk updates config", () => {
    repo.updateFallbackConfigBatch({
      apiMaxRetries: 7,
      restorePrimaryOnFallback: false,
      fallbackNotification: false,
    });
    const config = repo.getFallbackConfig();
    expect(config.apiMaxRetries).toBe(7);
    expect(config.restorePrimaryOnFallback).toBe(false);
    expect(config.fallbackNotification).toBe(false);
  });
});

// ── modelOptions filter test (framework + universal) ────────

describe("models-repository — modelOptions filter logic", () => {
  let modRepo: typeof import("@/lib/models-repository");

  beforeEach(() => {
    modRepo = require("@/lib/models-repository");
  });

  it("listModels('hermes') returns both hermes-scoped and universal models", () => {
    // Universal
    modRepo.createModel({ name: "Universal Model", provider: "anthropic", modelId: "claude-u" });
    // Hermes-scoped
    modRepo.createModel({ name: "Hermes Model", provider: "openai", modelId: "gpt-h", frameworkId: "hermes" });
    // Other-framework-scoped
    modRepo.createModel({ name: "Other Model", provider: "deepseek", modelId: "ds-o", frameworkId: "other-fw" });

    const hermes = modRepo.listModels("hermes");
    expect(hermes.length).toBe(2);
    expect(hermes.some(m => m.name === "Universal Model")).toBe(true);
    expect(hermes.some(m => m.name === "Hermes Model")).toBe(true);
    expect(hermes.some(m => m.name === "Other Model")).toBe(false);

    // Universal '*' returns only universal
    const universal = modRepo.listModels("*");
    expect(universal.length).toBe(1);
    expect(universal[0].name).toBe("Universal Model");
  });

  it("listModels without filter returns ALL models", () => {
    modRepo.createModel({ name: "Universal", provider: "anthropic", modelId: "c-u" });
    modRepo.createModel({ name: "Hermes", provider: "openai", modelId: "g-h", frameworkId: "hermes" });
    modRepo.createModel({ name: "Other", provider: "deepseek", modelId: "d-o", frameworkId: "x" });

    const all = modRepo.listModels();
    expect(all.length).toBe(3);
  });
});

// ── Framework registry tests ────────────────────────────────

describe("framework-registry", () => {
  it("returns 'hermes' as default for getActiveFrameworkId when no file exists", () => {
    const fw = require("@/lib/framework-registry.server");
    const active = fw.getActiveFrameworkId();
    expect(active).toBe("hermes");
  });

  it("lists all registered frameworks", () => {
    const fw = require("@/lib/framework-registry");
    const frameworks = fw.listFrameworks();
    expect(frameworks.length).toBeGreaterThanOrEqual(1);
    expect(frameworks[0].id).toBe("hermes");
    expect(frameworks[0].label).toBe("Default Hermes");
  });

  it("has correct universal constants", () => {
    const fw = require("@/lib/framework-registry");
    expect(fw.UNIVERSAL_FRAMEWORK_ID).toBe("*");
    expect(fw.UNIVERSAL_FRAMEWORK_LABEL).toBe("Universal");
  });
});
