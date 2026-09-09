/**
 * A custom fallback keeps the name, provider and model id the operator typed
 * (T-0140).
 *
 * `model_fallbacks` had no columns for a custom entry's identity. The INSERT
 * wrote only the registry FK, which a custom entry does not have, and every
 * read joined `models` for the name, provider and model id, which a custom
 * entry has no row in. So the POST echoed back what was typed, and the very
 * next list said Custom / custom / an empty model id, which is also what the
 * chain then pushed into config.yaml. Found on the isolated instance during
 * C3's walk (T-0138): four adds, four rows of "Custom".
 *
 * Migration 042 adds the three columns; the repository writes them for a
 * custom entry and reads them where the JOIN has nothing. Rows written before
 * the migration have lost what they were typed with and keep saying Custom.
 */

import { existsSync, readdirSync } from "fs";
import { join } from "path";
import type DatabaseNs from "better-sqlite3";

import { getSchemaVersion, setSchemaVersion } from "@/lib/db-schema";
import { execBaselineSchema } from "../helpers/baseline-db";

type RealDb = DatabaseNs.Database;
const Database = jest.requireActual(
  join(process.cwd(), "node_modules", "better-sqlite3", "lib", "index.js"),
) as unknown as new (path: string) => RealDb;
const migrationsDir = join(process.cwd(), "src", "lib", "db", "migrations");

let testDb: RealDb | null = null;
jest.mock("@/lib/db", () => require("../helpers/baseline-db").dbSingletonMock(() => testDb));

const pushed = jest.fn();
jest.mock("@/modules/hermes/lib/hermes-fallback-config", () => ({
  syncFallbacksToHermesConfig: (...a: unknown[]) => {
    pushed(...a);
    return { backupPath: null, configPath: "/tmp/config.yaml", hermesHome: "/tmp" };
  },
}));
jest.mock("@/lib/audit-log", () => ({ appendAuditLine: jest.fn() }));

import { addFallbackEntry, getFallbackEntry, listFallbackChain } from "@/lib/fallbacks-repository";
import { createModel } from "@/lib/models-repository";
import { syncEnabledFallbackChainToHermes } from "@/modules/hermes/lib/fallback-sync";

interface Applier {
  FALLBACK_IDENTITY_SCHEMA_VERSION: number;
  applyFallbackIdentityMigration: (db: RealDb, dir: string) => number;
}

/** Read at call time, so a missing applier is a red and not a compile error. */
function applier(): Applier {
  const mod = require("@/lib/db/sql-migrations") as Partial<Applier>;
  if (!mod.applyFallbackIdentityMigration) throw new Error("sql-migrations has no applyFallbackIdentityMigration yet");
  return mod as Applier;
}

const columnsOf = (db: RealDb, table: string) =>
  (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name);

describe("042_fallback_identity.sql", () => {
  it("exists, is the highest-numbered migration on disk, and its gate is 42, one above the gate it displaces", () => {
    expect(existsSync(join(migrationsDir, "042_fallback_identity.sql"))).toBe(true);
    const numbers = readdirSync(migrationsDir)
      .filter((f) => /^\d{3}_.*\.sql$/.test(f))
      .map((f) => parseInt(f.slice(0, 3), 10));
    expect(Math.max(...numbers)).toBe(42);
    expect(applier().FALLBACK_IDENTITY_SCHEMA_VERSION).toBe(42);
  });

  it("adds the three identity columns to a v41 table, bumps to 42, and is idempotent", () => {
    const db = new Database(":memory:");
    db.exec("CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);");
    db.exec(`CREATE TABLE model_fallbacks (
      id TEXT PRIMARY KEY, model_id TEXT, position INTEGER NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1, override_base_url TEXT,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL);`);
    setSchemaVersion(db, 41);
    expect(applier().applyFallbackIdentityMigration(db, migrationsDir)).toBe(42);
    expect(getSchemaVersion(db)).toBe(42);
    expect(columnsOf(db, "model_fallbacks")).toEqual(
      expect.arrayContaining(["custom_name", "custom_provider", "custom_model_id"]),
    );
    expect(applier().applyFallbackIdentityMigration(db, migrationsDir)).toBe(42);
    expect(columnsOf(db, "model_fallbacks").filter((c) => c === "custom_name")).toHaveLength(1);
    db.close();
  });
});

describe("the repository keeps a custom entry's identity", () => {
  beforeEach(() => {
    testDb = new Database(":memory:");
    execBaselineSchema(testDb);
    pushed.mockClear();
  });
  afterEach(() => {
    testDb?.close();
    testDb = null;
  });

  it("a custom entry lists and reads back with what was typed, not Custom", () => {
    const added = addFallbackEntry({ modelId: null, modelName: "Peek name", provider: "openai", modelIdString: "gpt-peek" });
    expect(added).toMatchObject({ modelName: "Peek name", provider: "openai", modelIdString: "gpt-peek" });
    const listed = listFallbackChain();
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({ id: added.id, modelId: null, modelName: "Peek name", provider: "openai", modelIdString: "gpt-peek" });
    expect(getFallbackEntry(added.id)).toMatchObject({ modelName: "Peek name", provider: "openai", modelIdString: "gpt-peek" });
  });

  it("a registry entry still reads its name, provider and model id from the model it points at", () => {
    const model = createModel({ name: "MiniMax-M3", provider: "minimax", modelId: "MiniMax-M3" });
    const added = addFallbackEntry({ modelId: model.id });
    expect(listFallbackChain()[0]).toMatchObject({ id: added.id, modelId: model.id, modelName: "MiniMax-M3", provider: "minimax", modelIdString: "MiniMax-M3" });
  });

  it("the chain pushed to Hermes carries the custom entry's model id and provider", () => {
    addFallbackEntry({ modelId: null, modelName: "Peek name", provider: "openai", modelIdString: "gpt-peek" });
    syncEnabledFallbackChainToHermes({ restorePrimaryOnFallback: true, fallbackNotification: false, apiMaxRetries: 2 });
    expect(pushed).toHaveBeenCalledTimes(1);
    expect(pushed.mock.calls[0][0]).toEqual([expect.objectContaining({ modelId: "gpt-peek", provider: "openai" })]);
  });

  it("a row written before the migration has nothing to read and still says Custom", () => {
    testDb!
      .prepare(
        "INSERT INTO model_fallbacks (id, model_id, position, enabled, override_base_url, created_at, updated_at) VALUES ('old', NULL, 1, 1, NULL, 't', 't')",
      )
      .run();
    expect(listFallbackChain()[0]).toMatchObject({ id: "old", modelName: "Custom", provider: "custom", modelIdString: "" });
  });
});
