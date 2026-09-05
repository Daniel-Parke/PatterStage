// ═══════════════════════════════════════════════════════════════
// db/index.ts — SQLite connection + migration runner
// Database: ~/patterstage/data/patterstage.db
//   (legacy fallback: ~/control-hub/data/control-hub.db until migrated)
//
// Relocated from src/lib/db.ts by operator ruling D8 (2026-08-22), so
// the connection module sits inside the directory that already holds
// the migration chain it runs. Every `@/lib/db` import is byte-identical
// across the move; only this file's own relative specifiers changed,
// and `resolveMigrationsDir`'s __dirname candidate, which now resolves
// to the same absolute path from one directory deeper.
//
// Three statements remain in this file, and all three are plumbing:
// the connection module's own work, not any table's business.
//
//   - tableExists()'s sqlite_master probe, which the migration runner
//     uses to decide whether a database is empty enough to take the
//     baseline. It reads the schema catalogue, not a table.
//   - runMigrations()'s CREATE TABLE IF NOT EXISTS meta, which has to
//     run before any repository can read anything, `meta` included.
//   - runMigrations()'s exec of the baseline .sql file, which IS the
//     schema. There is no repository to route it through, because
//     until it has run there are no tables to have one.
//
// Everything else that used to live here has gone to a repository:
// getGatewayPlatforms to sync/sync-repository.ts, and getSchemaHealth's
// two mission_categories statements to
// missions/mission-category-schema-repository.ts (which takes an open
// handle rather than calling getDb, so nothing cycles back through
// this module).
//
// The three are no longer counted by `sql-outside-repository`, because
// src/lib/db/ is exempt by location. They were not deleted and they did
// not move behind a seam; the file moved into the exempt directory by a
// sanctioned ruling, and this comment is where that is written down so
// the drop in the count is not mistaken for a migration.
// ═══════════════════════════════════════════════════════════════

import Database, { type Database as _DatabaseType } from "better-sqlite3";
import { join } from "path";
import { existsSync, readFileSync } from "fs";
import { PS_DATA_DIR, getDbPath } from "../paths";
import { getSchemaVersion, setSchemaVersion } from "../db-schema";
import {
  countMissionCategories,
  missionCategoriesTableExists,
} from "../missions/mission-category-schema-repository";
import { ensureDir } from "../fs/fs-helpers";
import { needsBaselineRebuild, rebuildToBaseline } from "./upgrade";
import { applyProfilesToolsParityUpgrade } from "./apply-profiles-tools-upgrade";
import { applyMissionRepeatMigration } from "./apply-mission-repeat-migration";
import { applyMissionQueueMigration } from "./apply-mission-queue-migration";
import { applyCronScheduleCanonicalisation } from "./apply-cron-schedule-canonicalisation";
import { applyRunsSchedulesMigration } from "./apply-runs-schedules-migration";
import { applyLegacyColumnRepair } from "./apply-legacy-column-repair";
import { applyDropGameTablesMigration } from "./apply-drop-game-tables-migration";
import { applyAnalyticsEventsMigration } from "./apply-analytics-events-migration";
import { applyChatMigration } from "./apply-chat-migration";
import { applyBenchmarksMigration } from "./apply-benchmarks-migration";
import { applyBenchmarkConfigMigration } from "./apply-benchmark-config-migration";
import { applyBenchmarkCatalogMigration } from "./apply-benchmark-catalog-migration";
import { applyBenchGatewaysMigration } from "./apply-bench-gateways-migration";
import { applyMissionPhasesMigration } from "./apply-mission-phases-migration";
import { applyDeepResearchMigration } from "./apply-deep-research-migration";
import { applyRetireMissionPhasesMigration } from "./apply-retire-mission-phases-migration";
import { applyComposerMigration } from "./apply-composer-migration";
import { applyMemoryProvidersMigration } from "./apply-memory-providers-migration";
import { applyResearchOptionsMigration } from "./apply-research-options-migration";
import { applyModelsApiStyleMigration } from "./apply-models-api-style-migration";
import { applyResearchComposerLinkMigration } from "./apply-research-composer-link-migration";
import { applyComposerGroupLinkMigration } from "./apply-composer-group-link-migration";
import { applyFrameworksMigration } from "./apply-frameworks-migration";
import { applyArtifactsMigration } from "./apply-artifacts-migration";
import { applyRecroomLibraryMigration } from "./apply-recroom-library-migration";
import { applyNeutralColumnNames } from "./apply-neutral-column-names";
import { applyAgentProgressionMigration } from "./apply-agent-progression-migration";
import { applyRetentionMigration } from "./apply-retention-migration";
import { applySpendPolicyMigration } from "./apply-spend-policy-migration";
import { applyResearchUsageMigration } from "./apply-research-usage-migration";
import { applyComposerRejectedMigration } from "./apply-composer-rejected-migration";
import { applyResearchGatherMigration } from "./apply-research-gather-migration";
import { applyComposerNodeCancelledMigration } from "./apply-composer-node-cancelled-migration";
import { applyOperatorPrefsMigration } from "./apply-operator-prefs-migration";
import { applyModelsOriginMigration } from "./apply-models-origin-migration";
import { applyRunsSpendSourceMigration } from "./apply-runs-spend-source-migration";
import { applyScheduleKindMigration } from "./apply-schedule-kind-migration";

// ── Ensure data directory exists ───────────────────────────────

const dataDir = PS_DATA_DIR;
ensureDir(dataDir);

const DB_PATH = getDbPath(dataDir);

// ── Connection factory ─────────────────────────────────────────

let _db: Database.Database | null = null;

/** Open (or reuse) the SQLite database connection. Runs migrations on first open. */
export function getDb(): Database.Database {
  if (_db) return _db;

  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
  _db.pragma("busy_timeout = 5000");

  // Run migrations to convergence. A brand-new DB applies the baseline (v3) and
  // returns early; the incremental appliers (v4→) only run on the *next* pass.
  // Loop here — exactly like `npm run db:migrate` — so a single getDb() reaches
  // the terminal schema version, instead of leaving a fresh DB half-migrated for
  // the whole process (the old "across boot" footgun: a first boot on an empty
  // PS_DATA_DIR would 500 with "no such table: composer_workflows"). The appliers
  // are idempotent + version-guarded, so the steady state is a cheap no-op pass.
  // runMigrations may reopen `_db` (baseline rebuild), so re-read it each pass.
  runMigrations(_db);
  let last = getSchemaVersion(_db);
  for (let i = 0; i < 8; i++) {
    runMigrations(_db!);
    const next = getSchemaVersion(_db!);
    if (next === last) break;
    last = next;
  }

  return _db!;
}

// ── Shorthand helpers ─────────────────────────────────────────

/**
 * Wrap `fn` in a SQLite transaction. Commits on success, rolls back on throw.
 * shorthand for `getDb().transaction(fn)()`.
 */
export function inTransaction<T>(fn: () => T): T {
  const database = getDb();
  return database.transaction(fn)();
}

/** Generate a cryptographically random UUID v4 string. */
export function uuid(): string {
  return crypto.randomUUID();
}

/** Return the current UTC time as an ISO-8601 string. */
export function now(): string {
  return new Date().toISOString();
}

// ── Migration runner ───────────────────────────────────────────

const BASELINE_SCHEMA_VERSION = 3;

function tableExists(database: Database.Database, name: string): boolean {
  const row = database
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(name) as { name: string } | undefined;
  return Boolean(row);
}

/**
 * Resolve the migrations directory robustly. In the production container the
 * Next.js server bundle does not co-locate the SQL files next to `__dirname`
 * (the path.join NFT tracing limitation), so we also probe a cwd-relative
 * source path that the Dockerfile copies into the image. First candidate that
 * actually contains the baseline wins.
 */
function resolveMigrationsDir(): string {
  const candidates = [
    join(__dirname, "migrations"),
    join(process.cwd(), "src", "lib", "db", "migrations"),
  ];
  for (const dir of candidates) {
    if (existsSync(join(dir, "001_baseline.sql"))) return dir;
  }
  return candidates[0];
}

/**
 * Apply all pending migrations to an open database. Exported so the upgrade
 * path can be exercised directly in tests (the full applier chain + wiring,
 * not just individual appliers).
 */
export function runMigrations(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const migrationsDir = resolveMigrationsDir();
  const baselinePath = join(migrationsDir, "001_baseline.sql");
  const baselineSql = existsSync(baselinePath)
    ? readFileSync(baselinePath, "utf-8")
    : "";

  const currentVersion = getSchemaVersion(database);
  const hasCoreSchema = tableExists(database, "missions") || tableExists(database, "agent_profiles");

  if (currentVersion === 0 && !hasCoreSchema && baselineSql) {
    database.exec(baselineSql);
    setSchemaVersion(database, BASELINE_SCHEMA_VERSION);
    return;
  }

  if (needsBaselineRebuild(database) && baselineSql) {
    rebuildToBaseline(database, DB_PATH, baselineSql);
    _db = null;
    _bootstrapped = false;
    const reopened = new Database(DB_PATH);
    reopened.pragma("journal_mode = WAL");
    reopened.pragma("foreign_keys = ON");
    reopened.pragma("busy_timeout = 5000");
    _db = reopened;
    return;
  }

  applyProfilesToolsParityUpgrade(database, migrationsDir);
  applyMissionRepeatMigration(database, migrationsDir);
  applyMissionQueueMigration(database, migrationsDir);
  applyCronScheduleCanonicalisation(database);
  applyRunsSchedulesMigration(database, migrationsDir);
  // Catch-up repair for the orphaned 005_cron_workdir + 006_sessions_message_count
  // column-adds the incremental chain skipped (v5→v7 jump). Runs last so it
  // repairs already-deployed v8 installs too. Idempotent on fresh DBs.
  applyLegacyColumnRepair(database);
  // Gamification dial-back: drop the removed RPG/Gacha game_* tables. Idempotent
  // (no-op on fresh installs; cleans already-migrated dev DBs).
  applyDropGameTablesMigration(database, migrationsDir);
  // Analytics interaction log (feeds the Insights page + derived achievements).
  // Idempotent CREATE ... IF NOT EXISTS at schema_version 12.
  applyAnalyticsEventsMigration(database, migrationsDir);
  // Agent-chat persistence (server-side conversations + messages, mapped to
  // Hermes sessions). Idempotent CREATE ... IF NOT EXISTS at schema_version 13.
  applyChatMigration(database, migrationsDir);
  // Agent benchmarking runs + per-item results (feeds the Agent Rating axis +
  // leaderboard). Idempotent CREATE ... IF NOT EXISTS at schema_version 14.
  applyBenchmarksMigration(database, migrationsDir);
  // (Agent + LLM) unit + augmentation tags on benchmark runs/results.
  // Additive ALTER ADD COLUMN, per-statement guarded, at schema_version 15.
  applyBenchmarkConfigMigration(database, migrationsDir);
  // Central fair-test catalog: tool_catalog + seed_memory_facts.
  // Idempotent CREATE ... IF NOT EXISTS at schema_version 16.
  applyBenchmarkCatalogMigration(database, migrationsDir);
  // Ephemeral benchmark gateway tracking + per-item metrics_json.
  // Idempotent CREATE + guarded ALTER at schema_version 17.
  applyBenchGatewaysMigration(database, migrationsDir);
  // Mission V2 multi-phase foundation: mission_phases / _phase_actions /
  // _approvals tables + additive missions/runs columns. Idempotent CREATE +
  // guarded ALTER at schema_version 18. V1 missions unaffected.
  applyMissionPhasesMigration(database, migrationsDir);
  // Native DeepResearch (Laboratory): research_runs + research_steps.
  // Idempotent CREATE ... IF NOT EXISTS at schema_version 19.
  applyDeepResearchMigration(database, migrationsDir);
  // Retire the superseded Mission-V2 phase foundation (replaced by Composer).
  // Drops the mission_phases tables + columns at schema_version 20.
  applyRetireMissionPhasesMigration(database, migrationsDir);
  // Composer graph orchestrator: workflows/nodes/edges/runs/node_runs/approvals
  // + runs.composer_node_run_id. Idempotent CREATE + guarded ALTER at v21.
  applyComposerMigration(database, migrationsDir);
  // PatterStage-owned memory provider config (host/port/bank in the DB, not in
  // Hermes files). Idempotent CREATE + seed at schema_version 22.
  applyMemoryProvidersMigration(database, migrationsDir);
  // Deep Research run config + saved presets. Guarded ALTER + CREATE at v23.
  applyResearchOptionsMigration(database, migrationsDir);
  // Direct-provider wire protocol per model (openai|anthropic). Guarded ALTER
  // + idempotent NULL-only repair at v24.
  applyModelsApiStyleMigration(database, migrationsDir);
  // Link a Deep Research run to the Composer node-run that spawned it (the
  // "research" node kind). Guarded ALTER at v25.
  applyResearchComposerLinkMigration(database, migrationsDir);
  // Link a nested sub-workflow run to the "group" node-run that spawned it.
  // Guarded ALTER at v26.
  applyComposerGroupLinkMigration(database, migrationsDir);
  // DB-owned agent-framework registry (Hermes today) — the FrameworkAdapter
  // seam. CREATE + seed at v27.
  applyFrameworksMigration(database, migrationsDir);
  // Unified artifacts registry (agent-produced deliverables). CREATE at v28.
  applyArtifactsMigration(database, migrationsDir);

  // Story Weaver reusable character + theme library. CREATE at v29.
  applyRecroomLibraryMigration(database, migrationsDir);

  // agent_root.framework_md -> framework_md, cron_jobs.external_job_id ->
  // external_job_id. RENAME at v30.
  applyNeutralColumnNames(database);

  // The append-only per-Body progression record (WG-ARCH-003, ADR-0004): the
  // level and achievements an agent had reached, captured so they survive the
  // retention prune of the history they were derived from. CREATE + two
  // append-only triggers at v31.
  applyAgentProgressionMigration(database, migrationsDir);

  // Declared retention for the two readings tables (WG-ARCH-008, ADR-0009):
  // the policy rows naming owner, consumer and window, plus the append-only
  // record of every applied prune. CREATE + seed at v32. Seeded DISABLED on
  // every install, so an upgrade deletes nothing.
  applyRetentionMigration(database, migrationsDir);

  // The operator's OPTIONAL provider-spend budget (WO-0014, T-0021): one row
  // holding a figure, the period it covers and whether breaching it stops
  // unattended dispatch. Seeded with NO figure and NO stop on every install, so
  // this upgrade changes no install's behaviour. CREATE + seed at v33.
  applySpendPolicyMigration(database, migrationsDir);

  // Deep Research token counts on research_runs, so the one source of spend the
  // database could not answer for becomes countable and the operator's hard stop
  // stops under-measuring. Three NULLABLE columns, no backfill: NULL means the
  // cost is unknown, which every pre-034 run genuinely is. ALTER at v34.
  applyResearchUsageMigration(database, migrationsDir);

  // A rejected Composer gate gets its own terminal status, so it stops being
  // rendered as a defect and stops leaving the rejected stage drawn green.
  // SQLite cannot ALTER a CHECK, so this is the chain's first table REBUILD:
  // it owns its own transaction and foreign_keys pragma, and it refuses to
  // run at all if either table's columns have drifted. REBUILD at v35.
  applyComposerRejectedMigration(database, migrationsDir);

  // How much of a research run's evidence was actually gathered. The engine
  // counted its search failures and threw the number away, so anything short of
  // a TOTAL outage shipped a confident report with no record that most of the
  // gather had failed. Four NULLABLE columns, no backfill: a pre-036 run
  // measured nothing, and zero would claim it measured a clean gather.
  // ALTER at v36.
  applyResearchGatherMigration(database, migrationsDir);

  // A cancelled Composer STAGE gets its own status, so stopping a run reads as
  // the deliberate act it is rather than as a crash. One table: composer_runs
  // has admitted `cancelled` since 021. REBUILD at v37.
  applyComposerNodeCancelledMigration(database, migrationsDir);

  // What the operator has set about the console itself (the rail collapsed,
  // quests done, the guide hidden), one JSON value per allow-listed key, so it
  // survives a browser and retention cannot un-complete a quest. CREATE at v38.
  applyOperatorPrefsMigration(database, migrationsDir);

  // Where a model row came from, and what the last import wrote into it, so an
  // operator's rename or proxy base URL is not undone by the next import.
  // ALTER at v39.
  applyModelsOriginMigration(database, migrationsDir);
  // T-0108: runs.story_id and runs.spend_source, so a run row says which
  // feature spent the money.
  applyRunsSpendSourceMigration(database, migrationsDir);
  // LAST rung, T-0107: schedules.kind and schedules.script_name, so a schedule
  // row can name a host script and PatterStage's own tick can run it where the
  // host has no crontab.
  applyScheduleKindMigration(database, migrationsDir);
}

// ── Bootstrap: ensure DB + schema exist ───────────────────────
// Call this at module load time for API routes that need the DB
// immediately (before first query).

let _bootstrapped = false;

/**
 * Ensure the database is open and migrations have run.
 * Idempotent — safe to call multiple times.
 */
export function ensureDb(): void {
  if (_bootstrapped) return;
  _bootstrapped = true;
  getDb(); // forces open + migrate
}

export interface SchemaHealth {
  schemaVersion: number;
  hasMissionCategoriesTable: boolean;
  categoryCount: number;
}

/** Report schema version and mission_categories table state (after ensureDb). */
export function getSchemaHealth(): SchemaHealth {
  ensureDb();
  const database = getDb();
  const schemaVersion = getSchemaVersion(database);
  const hasMissionCategoriesTable = missionCategoriesTableExists(database);
  let categoryCount = 0;
  if (hasMissionCategoriesTable) {
    categoryCount = countMissionCategories(database);
  }
  if (schemaVersion >= 2 && !hasMissionCategoriesTable) {
    console.error(
      "[db] schema_version >= 2 but mission_categories table is missing — database may be corrupt",
    );
  }
  return { schemaVersion, hasMissionCategoriesTable, categoryCount };
}
