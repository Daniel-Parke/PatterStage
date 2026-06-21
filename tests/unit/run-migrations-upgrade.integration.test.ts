/** @jest-environment node */
// Exercises the REAL runMigrations() entry point (not just individual appliers)
// against REAL SQLite, proving the full upgrade-path wiring: a legacy install
// that missed the orphaned 005/006 migrations AND predates runs/schedules ends
// up fully migrated. Guards the wiring so a future edit that drops an applier
// from runMigrations is caught in CI.

import { readFileSync } from "fs";
import { join } from "path";
import type DatabaseNs from "better-sqlite3";
import { getSchemaVersion, setSchemaVersion } from "@/lib/db-schema";

// jest.setup globally mocks "@/lib/db" (no runMigrations on the mock); pull the
// real implementation so we exercise the actual wiring.
const { runMigrations } = jest.requireActual<typeof import("@/lib/db")>("@/lib/db");

type RealDb = DatabaseNs.Database;

const Database = jest.requireActual(
  join(process.cwd(), "node_modules", "better-sqlite3", "lib", "index.js"),
) as unknown as new (path: string) => RealDb;

const migrationsDir = join(process.cwd(), "src", "lib", "db", "migrations");

function cols(db: RealDb, table: string): string[] {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((r) => r.name);
}
function tableNames(db: RealDb): string[] {
  return (
    db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]
  ).map((r) => r.name);
}

describe("runMigrations upgrade path (real SQLite, real wiring)", () => {
  it("upgrades a degraded legacy install to the full current schema", () => {
    const db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
    db.exec("CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);");
    db.exec(readFileSync(join(migrationsDir, "001_baseline.sql"), "utf-8"));
    db.prepare(
      "INSERT INTO cron_jobs (id, name, schedule) VALUES ('c1','job','0 0 * * *')",
    ).run();
    // A user mission must survive the upgrade unchanged (existing-main-user data).
    db.prepare(
      "INSERT INTO missions (id, name, prompt, status) VALUES ('m1','Legacy Mission','do x','successful')",
    ).run();

    // Simulate a legacy install: strip workdir + runs/schedules, mark it old.
    db.pragma("foreign_keys = OFF");
    db.exec("ALTER TABLE cron_jobs DROP COLUMN workdir");
    db.exec("DROP TABLE IF EXISTS runs");
    db.exec("DROP TABLE IF EXISTS schedules");
    db.pragma("foreign_keys = ON");
    setSchemaVersion(db, 2);

    runMigrations(db);

    expect(cols(db, "cron_jobs")).toContain("workdir");
    expect(cols(db, "sessions")).toContain("message_count");
    expect(tableNames(db)).toEqual(expect.arrayContaining(["runs", "schedules"]));
    // Gamification dial-back: the removed game_* tables must not be present.
    expect(tableNames(db)).not.toContain("game_player");
    expect(tableNames(db)).not.toContain("game_events");
    expect(cols(db, "missions")).toContain("run_id");
    // Analytics interaction log lands via the wired v12 applier (footgun guard:
    // a .sql file alone is inert — this proves runMigrations actually calls it).
    expect(tableNames(db)).toContain("analytics_events");
    // Agent-chat tables land via the wired v13 applier (same footgun guard).
    expect(tableNames(db)).toEqual(
      expect.arrayContaining(["chat_conversations", "chat_messages"]),
    );
    // Benchmark tables land via the wired v14 applier (same footgun guard).
    expect(tableNames(db)).toEqual(
      expect.arrayContaining(["benchmark_runs", "benchmark_item_results"]),
    );
    // The (Agent + LLM) unit columns land via the wired v15 ALTER applier.
    expect(cols(db, "benchmark_runs")).toContain("model_id");
    expect(cols(db, "benchmark_runs")).toContain("exec_mode");
    expect(cols(db, "benchmark_item_results")).toContain("memory_used");
    // The fair-test catalog tables land via the wired v16 applier.
    expect(tableNames(db)).toEqual(
      expect.arrayContaining(["tool_catalog", "seed_memory_facts"]),
    );
    // The benchmark gateway tracking table + per-item metrics land via v17.
    expect(tableNames(db)).toContain("bench_gateways");
    expect(cols(db, "benchmark_item_results")).toContain("metrics_json");
    // Mission V2 multi-phase foundation lands via the wired v18 applier.
    expect(tableNames(db)).toEqual(
      expect.arrayContaining(["mission_phases", "mission_phase_actions", "mission_approvals"]),
    );
    expect(cols(db, "missions")).toEqual(expect.arrayContaining(["version", "current_phase_id"]));
    expect(cols(db, "runs")).toContain("phase_action_id");
    // Native DeepResearch tables land via the wired v19 applier.
    expect(tableNames(db)).toEqual(expect.arrayContaining(["research_runs", "research_steps"]));
    expect(getSchemaVersion(db)).toBe(19);
    // Pre-existing data survived the additive upgrade (cron job + mission).
    expect(
      (db.prepare("SELECT COUNT(*) c FROM cron_jobs").get() as { c: number }).c,
    ).toBe(1);
    expect(
      (db.prepare("SELECT name FROM missions WHERE id = 'm1'").get() as { name: string }).name,
    ).toBe("Legacy Mission");
    db.close();
  });

  it("is idempotent — a second runMigrations on the upgraded DB is a no-op", () => {
    const db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
    db.exec("CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);");
    db.exec(readFileSync(join(migrationsDir, "001_baseline.sql"), "utf-8"));
    setSchemaVersion(db, 2);

    runMigrations(db);
    const v1 = getSchemaVersion(db);
    expect(() => runMigrations(db)).not.toThrow();
    expect(getSchemaVersion(db)).toBe(v1);
    expect(getSchemaVersion(db)).toBe(19);
    db.close();
  });
});
