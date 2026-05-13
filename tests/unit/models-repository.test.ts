/* eslint-disable @typescript-eslint/no-require-imports */
/** @jest-environment node */

/**
 * Unit tests for src/lib/models-repository.ts. Uses a real in-memory
 * SQLite (bypassing the global jest mock) so we exercise the partial
 * unique indexes from migration 006.
 */

import { readFileSync } from "fs";
import { join } from "path";

const repoRoot = join(__dirname, "..", "..");
const initialPath = join(repoRoot, "src", "lib", "db", "migrations", "001_initial_schema.sql");
const missionExtPath = join(repoRoot, "src", "lib", "db", "migrations", "004_mission_extensions.sql");
const statusEnumPath = join(repoRoot, "src", "lib", "db", "migrations", "005_mission_status_enum.sql");
const modelsPath = join(repoRoot, "src", "lib", "db", "migrations", "006_models_credentials.sql");
const migration012Path = join(repoRoot, "src", "lib", "db", "migrations", "012_models_framework_fallback.sql");
const hermesOnlyPath = join(repoRoot, "src", "lib", "db", "migrations", "014_hermes_only.sql");

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

beforeEach(() => {
  const Database = loadRealBetterSqlite3();
  testDb = new (Database as unknown as new (path: string) => import("better-sqlite3").Database)(
    ":memory:"
  );
  testDb.pragma("foreign_keys = ON");
  testDb.exec(readFileSync(initialPath, "utf-8"));
  testDb.exec(readFileSync(missionExtPath, "utf-8"));
  testDb.exec(readFileSync(statusEnumPath, "utf-8"));
  // Apply migration 006 for models/credentials, then 012 for framework/fallbacks
  // Migration 012 needs a guard to run safely in the test DB — the CREATE TABLE
  // IF NOT EXISTS guard ensures we can skip the guard rows
  testDb.exec(readFileSync(modelsPath, "utf-8"));
  testDb.exec(readFileSync(migration012Path, "utf-8"));
  // Apply migration 014 to reverse framework scaffolding (Hermes-only)
  testDb.exec(readFileSync(hermesOnlyPath, "utf-8"));
});

afterEach(() => {
  testDb?.close();
  testDb = null;
});

describe("models-repository — listModels / getModel / createModel", () => {
  it("returns empty list before any inserts", () => {
    const { listModels } = require("@/lib/models-repository") as typeof import("@/lib/models-repository");
    expect(listModels()).toEqual([]);
  });

  it("creates and reads a model with provider/modelId/baseUrl/contextLength", () => {
    const { createModel, getModel, listModels } = require("@/lib/models-repository") as typeof import("@/lib/models-repository");
    const created = createModel({
      name: "Sonnet 4 (custom endpoint)",
      provider: "anthropic",
      modelId: "anthropic/claude-sonnet-4",
      baseUrl: "https://api.anthropic.com",
      contextLength: 200000,
    });
    expect(created.name).toBe("Sonnet 4 (custom endpoint)");
    expect(created.modelId).toBe("anthropic/claude-sonnet-4");
    expect(created.baseUrl).toBe("https://api.anthropic.com");
    expect(created.contextLength).toBe(200000);

    expect(getModel(created.id)).toEqual(created);
    expect(listModels()).toEqual([created]);
  });

  it("rejects empty name/provider/modelId", () => {
    const { createModel } = require("@/lib/models-repository") as typeof import("@/lib/models-repository");
    expect(() => createModel({ name: "", provider: "anthropic", modelId: "x" })).toThrow(/name/);
    expect(() => createModel({ name: "x", provider: "", modelId: "x" })).toThrow(/provider/);
    expect(() => createModel({ name: "x", provider: "anthropic", modelId: "" })).toThrow(/modelId/);
  });
});

describe("models-repository — getModelWithKey resolves credential JOIN", () => {
  it("returns null apiKey when no credentialsId set", () => {
    const { createModel, getModelWithKey } = require("@/lib/models-repository") as typeof import("@/lib/models-repository");
    const m = createModel({ name: "Solo", provider: "anthropic", modelId: "anthropic/claude-sonnet-4" });
    const result = getModelWithKey(m.id);
    expect(result?.apiKey).toBeNull();
  });

  it("returns the joined plaintext key when credential is linked", () => {
    const { createCredential } = require("@/lib/credentials-repository") as typeof import("@/lib/credentials-repository");
    const { createModel, getModelWithKey } = require("@/lib/models-repository") as typeof import("@/lib/models-repository");
    const cred = createCredential({ label: "ANTH 1", provider: "anthropic", apiKey: "sk-ant-realsecret" });
    const m = createModel({
      name: "Linked",
      provider: "anthropic",
      modelId: "anthropic/claude-sonnet-4",
      credentialsId: cred.id,
    });
    const r = getModelWithKey(m.id);
    expect(r?.apiKey).toBe("sk-ant-realsecret");
  });
});

describe("models-repository — defaults", () => {
  it("returns null defaults when no models flagged", () => {
    const { getModelDefaults, getDefaultModel } = require("@/lib/models-repository") as typeof import("@/lib/models-repository");
    const defaults = getModelDefaults();
    for (const key of Object.keys(defaults) as Array<keyof typeof defaults>) {
      expect(defaults[key]).toBeNull();
    }
    expect(getDefaultModel("agent")).toBeNull();
  });

  it("setDefaultModel writes the slot and getDefaultModel returns it", () => {
    const { createModel, setDefaultModel, getDefaultModel } =
      require("@/lib/models-repository") as typeof import("@/lib/models-repository");
    const m = createModel({ name: "A", provider: "anthropic", modelId: "anthropic/claude-sonnet-4" });
    setDefaultModel("agent", m.id);
    expect(getDefaultModel("agent")?.id).toBe(m.id);
  });

  it("setDefaultModel with null clears the slot", () => {
    const { createModel, setDefaultModel, getDefaultModel } =
      require("@/lib/models-repository") as typeof import("@/lib/models-repository");
    const m = createModel({ name: "A", provider: "anthropic", modelId: "x" });
    setDefaultModel("agent", m.id);
    setDefaultModel("agent", null);
    expect(getDefaultModel("agent")).toBeNull();
  });

  it("setting a new default for the same slot clears the old default", () => {
    const { createModel, setDefaultModel, getDefaultModel } =
      require("@/lib/models-repository") as typeof import("@/lib/models-repository");
    const a = createModel({ name: "A", provider: "anthropic", modelId: "x" });
    const b = createModel({ name: "B", provider: "anthropic", modelId: "y" });
    setDefaultModel("agent", a.id);
    setDefaultModel("agent", b.id);
    expect(getDefaultModel("agent")?.id).toBe(b.id);

    // Post-migration 012: defaults live in model_defaults table, verified via getDefaultModel
    expect(getDefaultModel("agent")?.id).toBe(b.id);
  });

  it("createModel with defaults clears existing defaults (single-default invariant)", () => {
    const { createModel, getDefaultModel } =
      require("@/lib/models-repository") as typeof import("@/lib/models-repository");
    createModel({ name: "Old", provider: "anthropic", modelId: "x", defaults: { agent: true } });
    const next = createModel({
      name: "New",
      provider: "anthropic",
      modelId: "y",
      defaults: { agent: true },
    });
    expect(getDefaultModel("agent")?.id).toBe(next.id);
  });

  it("deleting the default leaves the slot null", () => {
    const { createModel, setDefaultModel, deleteModel, getDefaultModel } =
      require("@/lib/models-repository") as typeof import("@/lib/models-repository");
    const m = createModel({ name: "A", provider: "anthropic", modelId: "x" });
    setDefaultModel("agent", m.id);
    deleteModel(m.id);
    expect(getDefaultModel("agent")).toBeNull();
  });

  it("rejects unknown task type", () => {
    const { setDefaultModel, getDefaultModel } =
      require("@/lib/models-repository") as typeof import("@/lib/models-repository");
    expect(() => setDefaultModel("not-a-real-slot" as never, null)).toThrow(/Unknown task type/);
    expect(() => getDefaultModel("nope" as never)).toThrow(/Unknown task type/);
  });

  it("setDefaultModel with non-existent modelId throws", () => {
    const { setDefaultModel } = require("@/lib/models-repository") as typeof import("@/lib/models-repository");
    expect(() => setDefaultModel("agent", "no-such-id")).toThrow(/Model not found/);
  });
});

describe("models-repository — updateModel + deleteModel", () => {
  it("updateModel patches fields without losing untouched ones", () => {
    const { createModel, updateModel } = require("@/lib/models-repository") as typeof import("@/lib/models-repository");
    const m = createModel({
      name: "First",
      provider: "anthropic",
      modelId: "x",
      contextLength: 100000,
    });
    const u = updateModel(m.id, { name: "Renamed" });
    expect(u?.name).toBe("Renamed");
    expect(u?.modelId).toBe("x");
    expect(u?.contextLength).toBe(100000);
  });

  it("updateModel patches defaults to model_defaults table", () => {
    const { createModel, updateModel, getDefaultModel } =
      require("@/lib/models-repository") as typeof import("@/lib/models-repository");
    const a = createModel({ name: "A", provider: "anthropic", modelId: "x", defaults: { agent: true } });
    expect(getDefaultModel("agent")?.id).toBe(a.id);
    const b = createModel({ name: "B", provider: "anthropic", modelId: "y" });
    // Transfer default ownership to b via updateModel
    updateModel(b.id, { defaults: { agent: true } });
    expect(getDefaultModel("agent")?.id).toBe(b.id);

    // Verify a no longer holds the agent default
    expect(getDefaultModel("agent")?.id).toBe(b.id);
  });

  it("deleteModel returns false for unknown id", () => {
    const { deleteModel } = require("@/lib/models-repository") as typeof import("@/lib/models-repository");
    expect(deleteModel("nope")).toBe(false);
  });
});

describe("models-repository — listModels returns all models (no framework scoping)", () => {
  it("listModels returns all models", () => {
    const { createModel, listModels } = require("@/lib/models-repository") as typeof import("@/lib/models-repository");
    createModel({ name: "Universal", provider: "anthropic", modelId: "claude-1" });
    createModel({ name: "Hermes-only", provider: "openai", modelId: "gpt-4" });
    const all = listModels();
    expect(all).toHaveLength(2);
  });
});

describe("models-repository — defaults have no framework param", () => {
  it("setDefaultModel and getDefaultModel work without framework param", () => {
    const { createModel, setDefaultModel, getDefaultModel, getModelDefaults } =
      require("@/lib/models-repository") as typeof import("@/lib/models-repository");
    const m = createModel({ name: "FW Model", provider: "anthropic", modelId: "claude-fw" });

    setDefaultModel("agent", m.id);
    expect(getDefaultModel("agent")?.id).toBe(m.id);

    const defaults = getModelDefaults();
    expect(defaults.agent).toBe(m.id);
  });

  it("getModelDefaults returns null when no defaults set", () => {
    const { getModelDefaults } = require("@/lib/models-repository") as typeof import("@/lib/models-repository");
    const defaults = getModelDefaults();
    for (const key of Object.keys(defaults) as Array<keyof typeof defaults>) {
      expect(defaults[key]).toBeNull();
    }
  });

  it("listModels returns all models", () => {
    const { createModel, listModels } = require("@/lib/models-repository") as typeof import("@/lib/models-repository");
    createModel({ name: "Univ", provider: "anthropic", modelId: "a" });
    createModel({ name: "Hermes", provider: "openai", modelId: "b" });

    const allModels = listModels();
    expect(allModels).toHaveLength(2);
  });
});

describe("models-repository — model CRUD", () => {
  it("createModel returns the created model", () => {
    const { createModel, getModel } = require("@/lib/models-repository") as typeof import("@/lib/models-repository");
    const m = createModel({ name: "F", provider: "anthropic", modelId: "x" });
    expect(m.name).toBe("F");
    expect(getModel(m.id)?.name).toBe("F");
  });

  it("updateModel works with minimal update", () => {
    const { createModel, updateModel, getModel } = require("@/lib/models-repository") as typeof import("@/lib/models-repository");
    const m = createModel({ name: "F", provider: "anthropic", modelId: "x" });
    const updated = updateModel(m.id, { name: "F Updated" });
    expect(updated?.name).toBe("F Updated");
    expect(getModel(m.id)?.name).toBe("F Updated");
  });
});
