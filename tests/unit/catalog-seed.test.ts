/* eslint-disable @typescript-eslint/no-require-imports */
/** @jest-environment node */

import { existsSync } from "fs";
import { join } from "path";

import { execBaselineSchema } from "../helpers/baseline-db";

const repoRoot = join(__dirname, "..", "..");
const hasSeedPack = existsSync(join(repoRoot, "data/seed/profiles/manifest.json"));

let testDb: import("better-sqlite3").Database | null = null;

function loadRealBetterSqlite3(): typeof import("better-sqlite3") {
  return require("better-sqlite3/lib/index.js") as typeof import("better-sqlite3");
}

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

jest.mock("@/modules/hermes/lib/profile-sync", () => ({
  pushProfileToHermes: jest.fn(() => ({ success: true, slug: "qa", backupPath: null, error: null })),
  pushAllProfiles: jest.fn(() => [{ success: true, slug: "qa", backupPath: null, error: null }]),
}));

jest.mock("@/lib/paths", () => ({
  PS_DATA_DIR: join(repoRoot, "data"),
  PATHS: { patterStageDb: join(repoRoot, "data/control-hub.db") },
}));

beforeEach(() => {
  const Database = loadRealBetterSqlite3();
  testDb = new (Database as unknown as new (path: string) => import("better-sqlite3").Database)(
    ":memory:"
  );
  testDb.pragma("foreign_keys = ON");
  execBaselineSchema(testDb);
});

afterEach(() => {
  testDb?.close();
  testDb = null;
});

describe("runCatalogSeed", () => {
  (hasSeedPack ? it : it.skip)("merge seeds profiles and templates idempotently", () => {
    const { runCatalogSeed } = require("@/lib/seed/catalog-seed") as typeof import("@/lib/seed/catalog-seed");
    const { listProfiles } = require("@/modules/hermes/lib/profiles-repository") as typeof import("@/modules/hermes/lib/profiles-repository");

    const first = runCatalogSeed({ target: "all", mode: "merge" });
    expect(first.profiles).toBeGreaterThanOrEqual(6);
    expect(first.templates).toBeGreaterThanOrEqual(10);
    expect(listProfiles().length).toBeGreaterThanOrEqual(6);

    const second = runCatalogSeed({ target: "all", mode: "merge" });
    expect(second.profiles).toBe(0);
    expect(second.templates).toBe(0);
  });
});
