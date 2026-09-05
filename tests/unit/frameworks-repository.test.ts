/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports */
// Phase 2 — the DB-owned framework registry + adapter resolution.

import { join } from "path";

let testDb: import("better-sqlite3").Database | null = null;
jest.mock("@/lib/db", () => ({
  getDb: () => testDb!,
  ensureDb: () => undefined,
  now: () => new Date().toISOString(),
}));

import { applyFrameworksMigration } from "@/lib/db/apply-frameworks-migration";
import { getActiveFrameworkConfig, listFrameworks, updateFramework } from "@/lib/frameworks/repository";
import { getActiveFramework } from "@/lib/frameworks/registry";

const migrationsDir = join(process.cwd(), "src", "lib", "db", "migrations");

beforeEach(() => {
  const Database = require("better-sqlite3/lib/index.js") as typeof import("better-sqlite3");
  testDb = new (Database as unknown as new (p: string) => import("better-sqlite3").Database)(":memory:");
  testDb.exec("CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);");
  testDb.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '26')").run();
  applyFrameworksMigration(testDb, migrationsDir);
});
afterEach(() => {
  testDb?.close();
  testDb = null;
});

describe("frameworks repository + registry", () => {
  it("exposes the active Hermes framework with defaults", () => {
    expect(listFrameworks().map((f) => f.type)).toEqual(["hermes"]);
    const { type, config } = getActiveFrameworkConfig();
    expect(type).toBe("hermes");
    expect(config.home).toBeNull();
  });

  it("getActiveFramework resolves the Hermes adapter", () => {
    const fw = getActiveFramework();
    expect(fw.type).toBe("hermes");
    expect(fw.info().name).toBe("Hermes");
  });

  it("updateFramework sets a home override the adapter then uses", () => {
    updateFramework("hermes", { config: { home: "/custom/hermes" } });
    expect(getActiveFrameworkConfig().config.home).toBe("/custom/hermes");
    expect(getActiveFramework().home()).toBe("/custom/hermes");
  });
});
