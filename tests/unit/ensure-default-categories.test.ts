/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports */

import { readFileSync } from "fs";
import { join } from "path";

const repoRoot = join(__dirname, "..", "..");

function loadRealBetterSqlite3(): typeof import("better-sqlite3") {
  return require("better-sqlite3/lib/index.js") as typeof import("better-sqlite3");
}

describe("ensureDefaultCategories", () => {
  it("seeds all default categories when table is empty", () => {
    const Database = loadRealBetterSqlite3();
    const db = new (Database as unknown as new (
      path: string,
    ) => import("better-sqlite3").Database)(":memory:");
    db.pragma("foreign_keys = ON");

    db.exec(`
      CREATE TABLE mission_categories (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        color       TEXT NOT NULL DEFAULT 'cyan',
        sort_order  INTEGER NOT NULL DEFAULT 0,
        seed_key    TEXT,
        created_at  TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    db.prepare("DELETE FROM mission_categories").run();
    expect(
      (
        db.prepare("SELECT COUNT(*) AS c FROM mission_categories").get() as {
          c: number;
        }
      ).c,
    ).toBe(0);

    const seedSql = readFileSync(
      join(repoRoot, "src/lib/db/seeds/001_mission_categories.sql"),
      "utf-8",
    );
    db.exec(seedSql);

    const count = (
      db.prepare("SELECT COUNT(*) AS c FROM mission_categories").get() as {
        c: number;
      }
    ).c;
    expect(count).toBe(8);

    const general = db
      .prepare("SELECT seed_key FROM mission_categories WHERE id = 'general'")
      .get() as { seed_key: string };
    expect(general.seed_key).toBe("ch.cat.general");
    db.close();
  });
});
