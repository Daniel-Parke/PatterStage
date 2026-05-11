/* eslint-disable @typescript-eslint/no-require-imports */
/** @jest-environment node */

/**
 * Tests for syncDefaultsToHermesConfig: rewrites ~/.hermes/config.yaml
 * with `model.*` from the registry's agent default and `auxiliary.<task>.*`
 * for each of the 11 auxiliary slots.
 */

import { mkdtempSync, readFileSync, writeFileSync, existsSync, readdirSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import * as yaml from "js-yaml";

let fakeRoot: string;

const repoRoot = join(__dirname, "..", "..");
const initialPath = join(repoRoot, "src", "lib", "db", "migrations", "001_initial_schema.sql");
const missionExtPath = join(repoRoot, "src", "lib", "db", "migrations", "004_mission_extensions.sql");
const statusEnumPath = join(repoRoot, "src", "lib", "db", "migrations", "005_mission_status_enum.sql");
const modelsPath = join(repoRoot, "src", "lib", "db", "migrations", "006_models_credentials.sql");
const frameworkFallbackPath = join(repoRoot, "src", "lib", "db", "migrations", "012_models_framework_fallback.sql");

let testDb: import("better-sqlite3").Database | null = null;

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

jest.mock("@/lib/hermes-agent-runtime", () => ({
  getActiveHermesPaths: () => {
    const root = (global as { __FAKE_HERMES_ROOT__?: string }).__FAKE_HERMES_ROOT__!;
    return {
      root,
      env: join(root, ".env"),
      soul: join(root, "SOUL.md"),
      hermes: join(root, "HERMES.md"),
      agents: join(root, "AGENTS.md"),
      skills: join(root, "skills"),
      profiles: join(root, "profiles"),
      sessions: join(root, "sessions"),
      logs: join(root, "logs"),
      config: join(root, "config.yaml"),
      backups: join(root, "backups"),
      cronJobs: join(root, "cron", "jobs.json"),
      memoryDb: join(root, "memory_store.db"),
    };
  },
  getActiveHermesHome: () => (global as { __FAKE_HERMES_ROOT__?: string }).__FAKE_HERMES_ROOT__,
}));

// Mock framework-registry so sync-manager doesn't import fs in test context
jest.mock("@/lib/framework-registry", () => ({
  getActiveFrameworkId: () => "hermes",
  listFrameworks: () => [],
  FRAMEWORKS: [],
}));

function loadRealBetterSqlite3(): typeof import("better-sqlite3") {
  return require("better-sqlite3/lib/index.js") as typeof import("better-sqlite3");
}

beforeEach(() => {
  fakeRoot = mkdtempSync(join(tmpdir(), "ch-yaml-sync-"));
  (global as { __FAKE_HERMES_ROOT__?: string }).__FAKE_HERMES_ROOT__ = fakeRoot;

  const Database = loadRealBetterSqlite3();
  testDb = new (Database as unknown as new (path: string) => import("better-sqlite3").Database)(
    ":memory:"
  );
  testDb.pragma("foreign_keys = ON");
  testDb.exec(readFileSync(initialPath, "utf-8"));
  testDb.exec(readFileSync(missionExtPath, "utf-8"));
  testDb.exec(readFileSync(statusEnumPath, "utf-8"));
  testDb.exec(readFileSync(modelsPath, "utf-8"));
  // Apply migration 012 to add framework_id and model_defaults
  testDb.exec(readFileSync(frameworkFallbackPath, "utf-8"));
});

afterEach(() => {
  testDb?.close();
  testDb = null;
  if (fakeRoot && existsSync(fakeRoot)) rmSync(fakeRoot, { recursive: true, force: true });
});

describe("syncDefaultsToHermesConfig", () => {
  it("writes model.default + provider + base_url + empty api_key when agent default is set", () => {
    const { createModel, setDefaultModel } = require("@/lib/models-repository") as typeof import("@/lib/models-repository");
    const { syncDefaultsToHermesConfig } = require("@/lib/hermes-config-sync") as typeof import("@/lib/hermes-config-sync");

    const m = createModel({
      name: "Sonnet",
      provider: "anthropic",
      modelId: "anthropic/claude-sonnet-4",
      baseUrl: "https://api.anthropic.com",
      contextLength: 200000,
    });
    setDefaultModel("agent", m.id);

    syncDefaultsToHermesConfig();

    const cfg = yaml.load(readFileSync(join(fakeRoot, "config.yaml"), "utf-8")) as {
      model?: Record<string, unknown>;
      auxiliary?: Record<string, unknown>;
    };
    expect(cfg.model?.default).toBe("anthropic/claude-sonnet-4");
    expect(cfg.model?.provider).toBe("anthropic");
    expect(cfg.model?.base_url).toBe("https://api.anthropic.com");
    expect(cfg.model?.api_key).toBe("");
    expect(cfg.model?.context_length).toBe(200000);
  });

  it("writes auxiliary slots for each is_default_<task> = 1", () => {
    const { createModel, setDefaultModel } = require("@/lib/models-repository") as typeof import("@/lib/models-repository");
    const { syncDefaultsToHermesConfig } = require("@/lib/hermes-config-sync") as typeof import("@/lib/hermes-config-sync");

    const fast = createModel({ name: "fast", provider: "openai", modelId: "openai/gpt-5" });
    setDefaultModel("compression", fast.id);
    setDefaultModel("vision", fast.id);
    setDefaultModel("approval", fast.id);

    syncDefaultsToHermesConfig();

    const cfg = yaml.load(readFileSync(join(fakeRoot, "config.yaml"), "utf-8")) as {
      auxiliary: Record<string, { provider: string; model: string; api_key: string }>;
    };
    expect(cfg.auxiliary.compression.model).toBe("openai/gpt-5");
    expect(cfg.auxiliary.compression.provider).toBe("openai");
    expect(cfg.auxiliary.compression.api_key).toBe("");
    expect(cfg.auxiliary.vision.model).toBe("openai/gpt-5");
    expect(cfg.auxiliary.approval.model).toBe("openai/gpt-5");
  });

  it("preserves unrelated config sections in config.yaml", () => {
    const original = yaml.dump(
      {
        agent: { max_turns: 999, verbose: true },
        terminal: { backend: "docker" },
      },
      { lineWidth: -1 }
    );
    writeFileSync(join(fakeRoot, "config.yaml"), original);

    const { createModel, setDefaultModel } = require("@/lib/models-repository") as typeof import("@/lib/models-repository");
    const { syncDefaultsToHermesConfig } = require("@/lib/hermes-config-sync") as typeof import("@/lib/hermes-config-sync");
    const m = createModel({ name: "M", provider: "anthropic", modelId: "anthropic/claude-sonnet-4" });
    setDefaultModel("agent", m.id);

    syncDefaultsToHermesConfig();

    const cfg = yaml.load(readFileSync(join(fakeRoot, "config.yaml"), "utf-8")) as {
      agent: Record<string, unknown>;
      terminal: Record<string, unknown>;
      model: Record<string, unknown>;
    };
    expect(cfg.agent.max_turns).toBe(999);
    expect(cfg.agent.verbose).toBe(true);
    expect(cfg.terminal.backend).toBe("docker");
    expect(cfg.model.default).toBe("anthropic/claude-sonnet-4");
  });

  it("creates a backup of config.yaml before each write", () => {
    const original = yaml.dump({ agent: { verbose: false } }, { lineWidth: -1 });
    writeFileSync(join(fakeRoot, "config.yaml"), original);

    const { createModel, setDefaultModel } = require("@/lib/models-repository") as typeof import("@/lib/models-repository");
    const { syncDefaultsToHermesConfig } = require("@/lib/hermes-config-sync") as typeof import("@/lib/hermes-config-sync");
    const m = createModel({ name: "M", provider: "anthropic", modelId: "x" });
    setDefaultModel("agent", m.id);

    const result = syncDefaultsToHermesConfig();
    expect(result.backupPath).not.toBeNull();
    const backups = readdirSync(join(fakeRoot, "backups"));
    expect(backups.length).toBeGreaterThan(0);
  });

  it("does not produce legacy compression.summary_* keys", () => {
    const { createModel, setDefaultModel } = require("@/lib/models-repository") as typeof import("@/lib/models-repository");
    const { syncDefaultsToHermesConfig } = require("@/lib/hermes-config-sync") as typeof import("@/lib/hermes-config-sync");
    const m = createModel({ name: "M", provider: "anthropic", modelId: "x" });
    setDefaultModel("compression", m.id);

    syncDefaultsToHermesConfig();
    const text = readFileSync(join(fakeRoot, "config.yaml"), "utf-8");
    expect(text).not.toMatch(/summary_model/);
    expect(text).not.toMatch(/summary_provider/);
  });

  it("is a no-op for slots that have no default set", () => {
    const { syncDefaultsToHermesConfig } = require("@/lib/hermes-config-sync") as typeof import("@/lib/hermes-config-sync");
    syncDefaultsToHermesConfig();
    expect(existsSync(join(fakeRoot, "config.yaml"))).toBe(true);
    const text = readFileSync(join(fakeRoot, "config.yaml"), "utf-8");
    // No model section was written because no default exists.
    expect(text).not.toMatch(/^model:/m);
  });
});
