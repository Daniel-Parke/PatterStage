/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * Schema tests for the squashed baseline (replaces per-migration 006 checks).
 */

import { readFileSync } from "fs";
import { join } from "path";

const repoRoot = join(__dirname, "..", "..");
const baselinePath = join(repoRoot, "src", "lib", "db", "migrations", "001_baseline.sql");

function loadRealBetterSqlite3(): typeof import("better-sqlite3") {
  return require("better-sqlite3/lib/index.js") as typeof import("better-sqlite3");
}

function freshDb(): import("better-sqlite3").Database {
  const Database = loadRealBetterSqlite3();
  const db = new (Database as unknown as new (path: string) => import("better-sqlite3").Database)(
    ":memory:"
  );
  db.pragma("foreign_keys = ON");
  db.exec(readFileSync(baselinePath, "utf-8"));
  return db;
}

describe("Baseline — credentials table shape", () => {
  it("creates the expected columns", () => {
    const db = freshDb();
    const cols = db
      .prepare("PRAGMA table_info(credentials)")
      .all() as Array<{ name: string }>;
    const names = cols.map((c) => c.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "id",
        "label",
        "provider",
        "api_key",
        "key_hint",
        "created_at",
        "updated_at",
      ])
    );
    db.close();
  });
});

describe("Baseline — models table shape", () => {
  it("uses model_defaults instead of is_default_* columns on models", () => {
    const db = freshDb();
    const cols = db
      .prepare("PRAGMA table_info(models)")
      .all() as Array<{ name: string }>;
    const names = cols.map((c) => c.name);
    expect(names).toContain("import_key");
    expect(names.filter((n) => n.startsWith("is_default_"))).toHaveLength(0);

    const defaultsTables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='model_defaults'")
      .all();
    expect(defaultsTables.length).toBe(1);
    db.close();
  });
});
