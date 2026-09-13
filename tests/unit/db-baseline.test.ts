/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports */

import { readFileSync } from "fs";
import { join } from "path";

const repoRoot = join(__dirname, "..", "..");
const baselinePath = join(repoRoot, "src", "lib", "db", "migrations", "001_baseline.sql");

function loadRealBetterSqlite3(): typeof import("better-sqlite3") {
  return require("better-sqlite3/lib/index.js") as typeof import("better-sqlite3");
}

const EXPECTED_TABLES = [
  "missions",
  "credentials",
  "models",
  "model_defaults",
  "model_fallbacks",
  "fallback_config",
  "cron_jobs",
  "sessions",
  "stories",
  "sync_registry",
  "gateway_platforms",
  "error_log_entries",
  "agent_profiles",
  "agent_root",
  "skills",
  "catalog_templates",
  "agent_processes",
];

describe("001_baseline.sql", () => {
  it("creates all expected tables in memory", () => {
    const Database = loadRealBetterSqlite3();
    const db = new (Database as unknown as new (path: string) => import("better-sqlite3").Database)(
      ":memory:"
    );
    db.pragma("foreign_keys = ON");
    db.exec(readFileSync(baselinePath, "utf-8"));

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as Array<{ name: string }>;
    const names = tables.map((t) => t.name);

    for (const expected of EXPECTED_TABLES) {
      expect(names).toContain(expected);
    }

    const missionCols = db
      .prepare("PRAGMA table_info(missions)")
      .all() as Array<{ name: string }>;
    expect(missionCols.map((c) => c.name)).toEqual(
      expect.arrayContaining([
        "cron_job_id",
        "goals",
        "model_id",
        "provider",
        "suggested_toolsets",
      ]),
    );

    db.close();
  });

  it("accepts mission rows with canonical status enum", () => {
    const Database = loadRealBetterSqlite3();
    const db = new (Database as unknown as new (path: string) => import("better-sqlite3").Database)(
      ":memory:"
    );
    db.exec(readFileSync(baselinePath, "utf-8"));

    db.prepare(
      `INSERT INTO missions (id, name, prompt, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`
    ).run("m1", "Mission", "prompt", "dispatched");

    const row = db.prepare("SELECT status FROM missions WHERE id = ?").get("m1") as { status: string };
    expect(row.status).toBe("dispatched");
    db.close();
  });
});
