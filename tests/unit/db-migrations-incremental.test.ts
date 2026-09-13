/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports */

import { readFileSync } from "fs";
import { join } from "path";

const repoRoot = join(__dirname, "..", "..");
const migrationsDir = join(repoRoot, "src", "lib", "db", "migrations");

function loadRealBetterSqlite3(): typeof import("better-sqlite3") {
  return require("better-sqlite3/lib/index.js") as typeof import("better-sqlite3");
}

describe("baseline schema v2", () => {
  it("includes mission_categories, agent_profiles, and catalog_templates", () => {
    const Database = loadRealBetterSqlite3();
    const db = new (Database as unknown as new (
      path: string,
    ) => import("better-sqlite3").Database)(":memory:");
    db.pragma("foreign_keys = ON");

    const baselinePath = join(migrationsDir, "001_baseline.sql");
    db.exec(readFileSync(baselinePath, "utf-8"));

    for (const table of [
      "mission_categories",
      "agent_profiles",
      "catalog_templates",
      "missions",
    ]) {
      const row = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
        .get(table);
      expect(row).toBeTruthy();
    }

    const missionCols = db
      .prepare("PRAGMA table_info(missions)")
      .all() as Array<{ name: string }>;
    expect(missionCols.some((c) => c.name === "category_id")).toBe(true);
    expect(missionCols.some((c) => c.name === "output_format")).toBe(true);
    expect(missionCols.some((c) => c.name === "constraints")).toBe(true);

    const catCols = db
      .prepare("PRAGMA table_info(mission_categories)")
      .all() as Array<{ name: string }>;
    expect(catCols.some((c) => c.name === "seed_key")).toBe(true);
  });
});
