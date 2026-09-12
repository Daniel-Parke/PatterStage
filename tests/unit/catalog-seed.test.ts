/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports */

import { existsSync } from "fs";
import { join } from "path";

import { openBaselineDb } from "../helpers/baseline-db";

const repoRoot = join(__dirname, "..", "..");
const hasSeedPack = existsSync(join(repoRoot, "data/seed/profiles/manifest.json"));

let testDb: import("better-sqlite3").Database | null = null;

jest.mock("@/lib/db", () => require("../helpers/baseline-db").dbSingletonMock(() => testDb));

jest.mock("@/modules/hermes/lib/profile-push", () => ({
  pushProfileToHermes: jest.fn(() => ({ success: true, slug: "qa", backupPath: null, error: null })),
  pushAllProfiles: jest.fn(() => [{ success: true, slug: "qa", backupPath: null, error: null }]),
}));

jest.mock("@/lib/host/paths", () => ({
  PS_DATA_DIR: join(repoRoot, "data"),
  PATHS: { patterStageDb: join(repoRoot, "data/control-hub.db") },
}));

beforeEach(() => {
  testDb = openBaselineDb();
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
