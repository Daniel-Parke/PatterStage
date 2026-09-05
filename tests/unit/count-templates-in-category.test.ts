/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports */
// QA #3/#33: countTemplatesInCategory must count the built-in catalog templates
// (DB) the same way /api/templates does — not only disk custom templates — so
// the categories API agrees with the dashboard breakdown.

import { readFileSync } from "fs";
import { join } from "path";

let testDb: import("better-sqlite3").Database | null = null;

// Lightweight db mock — avoid loading the real db.ts (which resolves a DB path
// at import). mission-category-repository only needs db/inTransaction/now.
jest.mock("@/lib/db", () => ({
  getDb: () => testDb!,
  inTransaction: <T,>(fn: () => T) => testDb!.transaction(fn)(),
  now: () => new Date().toISOString(),
}));
// Custom-template dir is non-existent so only the DB catalog matters here.
jest.mock("@/lib/paths", () => ({
  PATHS: { templates: "/tmp/__no_such_templates_dir__" },
}));

import { countTemplatesInCategory } from "@/lib/missions/mission-category-repository";

const baselineSql = readFileSync(
  join(process.cwd(), "src", "lib", "db", "migrations", "001_baseline.sql"),
  "utf-8",
);

function seedCatalogTemplate(id: string, categoryId: string | null): void {
  testDb!
    .prepare("INSERT INTO catalog_templates (id, name, category_id) VALUES (?, ?, ?)")
    .run(id, `Template ${id}`, categoryId);
}

beforeEach(() => {
  const Database = require("better-sqlite3/lib/index.js") as typeof import("better-sqlite3");
  testDb = new (Database as unknown as new (p: string) => import("better-sqlite3").Database)(":memory:");
  testDb.exec(baselineSql);
  testDb.pragma("foreign_keys = OFF");
});
afterEach(() => {
  testDb?.close();
  testDb = null;
});

describe("countTemplatesInCategory — counts the DB catalog (not only disk)", () => {
  it("counts built-in catalog templates by category_id", () => {
    seedCatalogTemplate("a", "engineering");
    seedCatalogTemplate("b", "engineering");
    seedCatalogTemplate("c", "quality");
    expect(countTemplatesInCategory("engineering")).toBe(2);
    expect(countTemplatesInCategory("quality")).toBe(1);
    expect(countTemplatesInCategory("data")).toBe(0);
  });

  it("treats a null category_id as 'general' (matching /api/templates)", () => {
    seedCatalogTemplate("a", null);
    seedCatalogTemplate("b", "general");
    expect(countTemplatesInCategory("general")).toBe(2);
  });
});
