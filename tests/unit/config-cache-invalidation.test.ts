/* eslint-disable @typescript-eslint/no-require-imports */
/** @jest-environment node */

/**
 * WO-0006 / WG-ARCH-003 (B for the config read).
 *
 * `readCachedConfig` caches config.yaml in the `meta` table for 15 seconds.
 * Before this, only `PUT /api/config` invalidated that cache, so every other
 * writer left the TTL as the sole owner of correctness: push a model, read it
 * back inside the window, get the old value.
 *
 * These tests are deliberately end-to-end rather than mock-checking. The DB is
 * real in-memory SQLite on the baseline schema, so the cache genuinely writes
 * and reads `meta` rows, and `getAgentWorkspace()` resolves through the same
 * mocked Hermes paths the writers use. A test that asserted
 * `expect(invalidateConfigCache).toHaveBeenCalled()` would pass even if the
 * cache never actually cleared.
 *
 * Each test states the stale value it would have observed, so a regression
 * reports the bug rather than just a failed equality.
 */

import { mkdtempSync, writeFileSync, existsSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import * as yaml from "js-yaml";

import { execBaselineSchema } from "../helpers/baseline-db";

let fakeRoot: string;
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

jest.mock("@/modules/hermes/lib/agent-runtime", () => ({
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

function loadRealBetterSqlite3(): typeof import("better-sqlite3") {
  return require("better-sqlite3/lib/index.js") as typeof import("better-sqlite3");
}

const configPath = () => join(fakeRoot, "config.yaml");

/** Cache rows present in `meta`. Zero means the cache is cold. */
function cachedRowCount(): number {
  const row = testDb!
    .prepare(
      "SELECT COUNT(*) AS c FROM meta WHERE key IN ('config.cached_json', 'config.cached_at')",
    )
    .get() as { c: number };
  return row.c;
}

beforeEach(() => {
  fakeRoot = mkdtempSync(join(tmpdir(), "ps-cfg-cache-"));
  (global as { __FAKE_HERMES_ROOT__?: string }).__FAKE_HERMES_ROOT__ = fakeRoot;

  const Database = loadRealBetterSqlite3();
  testDb = new (Database as unknown as new (path: string) => import("better-sqlite3").Database)(
    ":memory:",
  );
  testDb.pragma("foreign_keys = ON");
  execBaselineSchema(testDb);
});

afterEach(() => {
  testDb?.close();
  testDb = null;
  if (fakeRoot && existsSync(fakeRoot)) rmSync(fakeRoot, { recursive: true, force: true });
});

describe("the config read cache is a cache, not the source of truth", () => {
  it("warms on first read and serves the warm copy", () => {
    writeFileSync(configPath(), yaml.dump({ agent: { max_turns: 111 } }), "utf-8");
    const { readCachedConfig } = require("@/lib/config-cache") as typeof import("@/lib/config-cache");

    expect(cachedRowCount()).toBe(0);
    expect((readCachedConfig() as { agent: { max_turns: number } }).agent.max_turns).toBe(111);
    expect(cachedRowCount()).toBe(2);

    // A write straight to disk that bypasses every writer is exactly what the
    // TTL is a backstop FOR, and it is still served stale. This asserts the
    // cache works, so the tests below prove invalidation rather than absence.
    writeFileSync(configPath(), yaml.dump({ agent: { max_turns: 222 } }), "utf-8");
    expect((readCachedConfig() as { agent: { max_turns: number } }).agent.max_turns).toBe(111);
  });
});

describe("every writer of config.yaml invalidates the read cache", () => {
  it("syncDefaultsToHermesConfig", () => {
    const { createModel, setDefaultModel } =
      require("@/lib/models-repository") as typeof import("@/lib/models-repository");
    const { syncDefaultsToHermesConfig } =
      require("@/modules/hermes/lib/config-sync") as typeof import("@/modules/hermes/lib/config-sync");
    const { readCachedConfig } = require("@/lib/config-cache") as typeof import("@/lib/config-cache");

    writeFileSync(configPath(), yaml.dump({ model: { default: "stale/model" } }), "utf-8");
    expect(
      (readCachedConfig() as { model: { default: string } }).model.default,
    ).toBe("stale/model");
    expect(cachedRowCount()).toBe(2);

    const m = createModel({ name: "Sonnet", provider: "anthropic", modelId: "anthropic/fresh" });
    setDefaultModel("agent", m.id);
    syncDefaultsToHermesConfig();

    expect(cachedRowCount()).toBe(0);
    // Without invalidation this read returns "stale/model" for up to 15 seconds.
    expect((readCachedConfig() as { model: { default: string } }).model.default).toBe(
      "anthropic/fresh",
    );
  });

  it("syncSingleModelToHermesConfig", () => {
    const { createModel } = require("@/lib/models-repository") as typeof import("@/lib/models-repository");
    const { syncSingleModelToHermesConfig } =
      require("@/modules/hermes/lib/config-sync") as typeof import("@/modules/hermes/lib/config-sync");
    const { readCachedConfig } = require("@/lib/config-cache") as typeof import("@/lib/config-cache");

    writeFileSync(configPath(), yaml.dump({ model: { default: "stale/model" } }), "utf-8");
    readCachedConfig();
    expect(cachedRowCount()).toBe(2);

    const m = createModel({ name: "Pushed", provider: "openai", modelId: "openai/pushed" });
    syncSingleModelToHermesConfig(m.id);

    expect(cachedRowCount()).toBe(0);
    expect((readCachedConfig() as { model: { default: string } }).model.default).toBe(
      "openai/pushed",
    );
  });

  it("syncFallbacksToHermesConfig", () => {
    const { syncFallbacksToHermesConfig } =
      require("@/modules/hermes/lib/hermes-fallback-config") as typeof import("@/modules/hermes/lib/hermes-fallback-config");
    const { readCachedConfig } = require("@/lib/config-cache") as typeof import("@/lib/config-cache");

    writeFileSync(configPath(), yaml.dump({ agent: { api_max_retries: 2 } }), "utf-8");
    readCachedConfig();
    expect(cachedRowCount()).toBe(2);

    syncFallbacksToHermesConfig([], { apiMaxRetries: 9 });

    expect(cachedRowCount()).toBe(0);
    expect(
      (readCachedConfig() as { agent: { api_max_retries: number } }).agent.api_max_retries,
    ).toBe(9);
  });

  it("finalizeRootConfigOnDisk, which is covered by construction rather than by a call of its own", () => {
    // It writes config.yaml by delegating to syncDefaultsToHermesConfig. This is
    // the reason invalidation lives in one write helper instead of at the four
    // sites WO-0006 enumerated: a writer that writes THROUGH another writer
    // inherits the invalidation without anyone remembering to add it.
    const { createModel, setDefaultModel } =
      require("@/lib/models-repository") as typeof import("@/lib/models-repository");
    const { finalizeRootConfigOnDisk } =
      require("@/modules/hermes/lib/config-sync") as typeof import("@/modules/hermes/lib/config-sync");
    const { readCachedConfig } = require("@/lib/config-cache") as typeof import("@/lib/config-cache");

    writeFileSync(configPath(), yaml.dump({ model: { default: "stale/model" } }), "utf-8");
    readCachedConfig();
    expect(cachedRowCount()).toBe(2);

    const m = createModel({ name: "Final", provider: "anthropic", modelId: "anthropic/final" });
    setDefaultModel("agent", m.id);
    finalizeRootConfigOnDisk();

    expect(cachedRowCount()).toBe(0);
    expect((readCachedConfig() as { model: { default: string } }).model.default).toBe(
      "anthropic/final",
    );
  });
});

describe("invalidation does not fire for writes that are not config.yaml", () => {
  it("an .env write leaves a warm config cache alone", () => {
    // `atomicWriteFile` deliberately does NOT invalidate: it writes .env as well,
    // and a generic file writer should not know which caches exist. If this test
    // ever fails, the invalidation has been pushed down too far. Both writers
    // live in `hermes-config-write.ts` so the line between them stays visible.
    const { syncCredentialToHermesEnv } =
      require("@/modules/hermes/lib/hermes-env-sync") as typeof import("@/modules/hermes/lib/hermes-env-sync");
    const { readCachedConfig } = require("@/lib/config-cache") as typeof import("@/lib/config-cache");

    writeFileSync(configPath(), yaml.dump({ agent: { max_turns: 7 } }), "utf-8");
    readCachedConfig();
    expect(cachedRowCount()).toBe(2);

    syncCredentialToHermesEnv({ provider: "anthropic", apiKey: "sk-test-not-a-real-key" });

    expect(cachedRowCount()).toBe(2);
  });
});
