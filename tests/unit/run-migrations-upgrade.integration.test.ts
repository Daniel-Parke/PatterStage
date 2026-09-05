/** @jest-environment node */
// Exercises the REAL runMigrations() entry point (not just individual appliers)
// against REAL SQLite, proving the full upgrade-path wiring: a legacy install
// that missed the orphaned 005/006 migrations AND predates runs/schedules ends
// up fully migrated. Guards the wiring so a future edit that drops an applier
// from runMigrations is caught in CI.

import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import type DatabaseNs from "better-sqlite3";
import {
  MIGRATION_HEAD_SCHEMA_VERSION,
  getSchemaVersion,
  setSchemaVersion,
} from "@/lib/db-schema";
// The last applier's own gate, and the one before it. Imported by their own
// specifiers, which the global "@/lib/db" mock does not intercept, so these are
// the real numbers the chain ends on.
import { OPERATOR_PREFS_SCHEMA_VERSION } from "@/lib/db/apply-operator-prefs-migration";
import { MODELS_ORIGIN_SCHEMA_VERSION } from "@/lib/db/apply-models-origin-migration";
import { RUNS_SPEND_SOURCE_SCHEMA_VERSION } from "@/lib/db/apply-runs-spend-source-migration";
import { SCHEDULE_KIND_SCHEMA_VERSION } from "@/lib/db/apply-schedule-kind-migration";
import { COMPOSER_NODE_CANCELLED_SCHEMA_VERSION } from "@/lib/db/apply-composer-node-cancelled-migration";
import { RESEARCH_GATHER_SCHEMA_VERSION } from "@/lib/db/apply-research-gather-migration";
import { COMPOSER_REJECTED_SCHEMA_VERSION } from "@/lib/db/apply-composer-rejected-migration";
import { RESEARCH_USAGE_SCHEMA_VERSION } from "@/lib/db/apply-research-usage-migration";

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
    // Native DeepResearch tables land via the wired v19 applier.
    expect(tableNames(db)).toEqual(expect.arrayContaining(["research_runs", "research_steps"]));
    // The superseded Mission-V2 phase tables (created by v18) are dropped by the
    // v20 retirement migration — Composer replaces them.
    expect(tableNames(db)).not.toContain("mission_phases");
    expect(tableNames(db)).not.toContain("mission_phase_actions");
    expect(tableNames(db)).not.toContain("mission_approvals");
    // Composer graph tables land via the wired v21 applier.
    expect(tableNames(db)).toEqual(
      expect.arrayContaining(["composer_workflows", "composer_nodes", "composer_edges", "composer_runs", "composer_node_runs", "composer_approvals"]),
    );
    expect(cols(db, "runs")).toContain("composer_node_run_id");
    // PatterStage-owned memory provider config lands via the wired v22 applier,
    // seeded with the default Hindsight row.
    expect(tableNames(db)).toContain("memory_providers");
    expect(
      (db.prepare("SELECT COUNT(*) c FROM memory_providers WHERE type='hindsight'").get() as { c: number }).c,
    ).toBe(1);
    // Deep Research run config + presets land via the wired v23 applier.
    expect(tableNames(db)).toContain("research_presets");
    expect(cols(db, "research_runs")).toContain("config_json");
    // models.api_style (direct-provider wire protocol) lands via the wired v24
    // applier; MiniMax's /anthropic base is repaired to the anthropic protocol.
    expect(cols(db, "models")).toContain("api_style");
    // research_runs.composer_node_run_id (research-as-Composer-node link) lands
    // via the wired v25 applier.
    expect(cols(db, "research_runs")).toContain("composer_node_run_id");
    // composer_runs.parent_node_run_id (group sub-workflow link) lands via v26.
    expect(cols(db, "composer_runs")).toContain("parent_node_run_id");
    // frameworks registry (DB-owned active agent framework) lands via v27,
    // seeded with the default Hermes row.
    expect(tableNames(db)).toContain("frameworks");
    expect(
      (db.prepare("SELECT COUNT(*) c FROM frameworks WHERE type='hermes'").get() as { c: number }).c,
    ).toBe(1);
    // The unified artifacts registry lands via the wired v28 applier; the
    // Story Weaver character/theme library is v29; the vendor-name renames are
    // v30; the append-only per-Body progression record is v31; the declared
    // retention policy is v32; the operator's optional spend budget is v33 and
    // is the current terminal.
    expect(tableNames(db)).toContain("artifacts");
    expect(tableNames(db)).toContain("story_characters");
    expect(tableNames(db)).toContain("story_themes");
    expect(tableNames(db)).toContain("agent_progression_snapshots");
    expect(tableNames(db)).toEqual(
      expect.arrayContaining(["retention_policy", "retention_prune_runs"]),
    );
    expect(tableNames(db)).toContain("spend_policy");
    // The console's own settings land via the wired v38 applier (T-0097).
    expect(tableNames(db)).toContain("operator_prefs");
    expect(getSchemaVersion(db)).toBe(MIGRATION_HEAD_SCHEMA_VERSION);

    // The sister of the retention assertion below, and the reason T-0021 is
    // tier R2: an install climbing this ladder arrives with NO budget figure and
    // NO hard stop. An upgrade that silently started refusing to dispatch, or
    // that shipped somebody else's ceiling, would be the exact failure the
    // operator's ruling was written against.
    expect(
      db.prepare("SELECT limit_usd, hard_stop FROM spend_policy WHERE id = 1").get() as {
        limit_usd: number | null;
        hard_stop: number;
      },
    ).toEqual({ limit_usd: null, hard_stop: 0 });

    // The single most important assertion about this upgrade (ADR-0009): a real
    // install climbing the ladder arrives with retention SWITCHED OFF. The
    // seeded mission above is still here for the same reason: an upgrade adds
    // capability and never removes history.
    expect(
      (
        db.prepare("SELECT COUNT(*) c FROM retention_policy WHERE enabled = 0").get() as {
          c: number;
        }
      ).c,
    ).toBe(2);

    // v30 renamed two vendor-named columns in tables PatterStage owns. This is
    // the only DESTRUCTIVE-shaped migration in the chain (a rename, not an add),
    // so the upgrade path asserts both the new names and the absence of the old.
    expect(cols(db, "agent_root")).toContain("framework_md");
    expect(cols(db, "agent_root")).not.toContain("hermes_md");
    expect(cols(db, "cron_jobs")).toContain("external_job_id");
    expect(cols(db, "cron_jobs")).not.toContain("hermes_job_id");

    // Pre-existing data survived the additive upgrade (cron job + mission).
    expect(
      (db.prepare("SELECT COUNT(*) c FROM cron_jobs").get() as { c: number }).c,
    ).toBe(1);
    expect(
      (db.prepare("SELECT name FROM missions WHERE id = 'm1'").get() as { name: string }).name,
    ).toBe("Legacy Mission");
    db.close();
  });

  it("a truly fresh DB needs convergence: one pass stops at baseline, the getDb loop reaches terminal", () => {
    // A brand-new PS_DATA_DIR: empty DB, no baseline, no meta. runMigrations
    // applies the baseline (v3) and returns early — the incremental appliers
    // (v4→) only run on subsequent passes. getDb() loops to convergence so a
    // single first boot reaches the terminal schema; this guards that contract
    // (regression for "no such table: composer_workflows" on first boot).
    const db = new Database(":memory:");
    db.pragma("foreign_keys = ON");

    runMigrations(db); // pass 1 — baseline only
    expect(getSchemaVersion(db)).toBe(3);
    expect(tableNames(db)).not.toContain("composer_workflows");

    // Replicate the getDb() convergence loop.
    let last = getSchemaVersion(db);
    for (let i = 0; i < 8; i++) {
      runMigrations(db);
      const next = getSchemaVersion(db);
      if (next === last) break;
      last = next;
    }
    expect(getSchemaVersion(db)).toBe(MIGRATION_HEAD_SCHEMA_VERSION);
    expect(tableNames(db)).toEqual(
      expect.arrayContaining([
        "composer_workflows",
        "benchmark_runs",
        "research_runs",
        "analytics_events",
      ]),
    );
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
    expect(getSchemaVersion(db)).toBe(MIGRATION_HEAD_SCHEMA_VERSION);
    db.close();
  });

  // The head is stated in three places: the constant, the last applier's gate and
  // the migrations directory. Nothing forces them to agree, and for a long time
  // they did not: docs/running/migration.md claimed 13 and 11 while the chain climbed to
  // 30. These two assertions are what stop that happening again. They are cheap,
  // they need no database, and they fail on the commit that introduces the drift
  // rather than on the install that trips over it.
  describe("the head constant cannot drift from the chain", () => {
    it("equals the last applier's version gate", () => {
      expect(MIGRATION_HEAD_SCHEMA_VERSION).toBe(SCHEDULE_KIND_SCHEMA_VERSION);
    });

    // schema_version strictly increases and a gate is claimed once, which is
    // docs/running/migration.md's going-forward rule. The head moving by exactly one
    // above the applier that used to hold it is what that rule looks like from
    // the outside, and it catches a new migration that reuses or skips a number.
    it("sits exactly one above the gate it displaced", () => {
      expect(SCHEDULE_KIND_SCHEMA_VERSION).toBe(RUNS_SPEND_SOURCE_SCHEMA_VERSION + 1);
      expect(RUNS_SPEND_SOURCE_SCHEMA_VERSION).toBe(MODELS_ORIGIN_SCHEMA_VERSION + 1);
      expect(MODELS_ORIGIN_SCHEMA_VERSION).toBe(OPERATOR_PREFS_SCHEMA_VERSION + 1);
      expect(OPERATOR_PREFS_SCHEMA_VERSION).toBe(COMPOSER_NODE_CANCELLED_SCHEMA_VERSION + 1);
      expect(COMPOSER_NODE_CANCELLED_SCHEMA_VERSION).toBe(RESEARCH_GATHER_SCHEMA_VERSION + 1);
      // The rung below, kept so the ladder is checked over three rungs rather
      // than two: a pair of appliers that BOTH moved wrongly could otherwise
      // still sit one apart and pass.
      expect(RESEARCH_GATHER_SCHEMA_VERSION).toBe(COMPOSER_REJECTED_SCHEMA_VERSION + 1);
      // A fourth rung. Each new migration used to push the oldest constant out
      // of this test and leave it exported with no consumer -- which knip
      // correctly reports as dead. Deepening the ladder keeps every gate
      // checked and makes the chain harder to break in the middle.
      expect(COMPOSER_REJECTED_SCHEMA_VERSION).toBe(RESEARCH_USAGE_SCHEMA_VERSION + 1);
    });

    it("equals the highest-numbered migration file on disk", () => {
      const numbers = readdirSync(migrationsDir)
        .filter((f) => /^\d{3}_.*\.sql$/.test(f))
        .map((f) => parseInt(f.slice(0, 3), 10));

      // Guard the guard: an empty or unreadable directory must not read as pass.
      expect(numbers.length).toBeGreaterThan(20);
      expect(Math.max(...numbers)).toBe(MIGRATION_HEAD_SCHEMA_VERSION);
    });
  });
});
