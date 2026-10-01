// Ordered SQL migrations and their historical guarded additions or seeds.
// Rebuilds, canonicalisation and live-shape repairs retain specialised drivers.

import type Database from "better-sqlite3";
import { join } from "path";

import { getSchemaVersion, setSchemaVersion } from "@/lib/db-schema";
import { execAdditiveMigrationFile, execIdempotent, execMigrationFile } from "./apply-sql";

/** `[schema version it takes the database to, the file that does it]`, ascending. */
export const SQL_MIGRATIONS: ReadonlyArray<readonly [version: number, file: string]> = [
  [11, "011_drop_game_tables.sql"],
  [12, "012_analytics_events.sql"],
  [13, "013_chat.sql"],
  [14, "014_benchmarks.sql"],
  [15, "015_benchmark_config.sql"],
  [16, "016_benchmark_catalog.sql"],
  [17, "017_bench_gateways.sql"],
  [18, "018_mission_phases.sql"],
  [19, "019_deep_research.sql"],
  [20, "020_retire_mission_phases.sql"],
  [21, "021_composer.sql"],
  [22, "022_memory_providers.sql"],
  [23, "023_research_options.sql"],
  [24, "024_models_api_style.sql"],
  [25, "025_research_composer_link.sql"],
  [26, "026_composer_group_link.sql"],
  [27, "027_frameworks.sql"],
  [28, "028_artifacts.sql"],
  [29, "029_recroom_library.sql"],
  [31, "031_agent_progression.sql"],
  [32, "032_retention.sql"],
  [33, "033_spend_policy.sql"],
  [34, "034_research_usage.sql"],
  [36, "036_research_gather_health.sql"],
  [38, "038_operator_prefs.sql"],
  [39, "039_models_origin.sql"],
  [40, "040_runs_spend_source.sql"],
  [41, "041_schedule_kind.sql"],
  [42, "042_fallback_identity.sql"],
];

function addColumns(database: Database.Database, table: string, declarations: readonly string[]): void {
  const columns = new Set((database.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((row) => row.name));
  for (const declaration of declarations) {
    if (!columns.has(declaration.split(" ", 1)[0])) database.exec(`ALTER TABLE ${table} ADD COLUMN ${declaration}`);
  }
}

function seedEmptyRegistry(
  database: Database.Database, table: "memory_providers" | "frameworks", labelColumn: "label" | "name",
  type: string, label: string, config: Record<string, unknown>,
): void {
  const count = (database.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as { c: number }).c;
  if (count === 0) {
    database.prepare(`INSERT INTO ${table} (type, ${labelColumn}, enabled, is_active, config_json) VALUES (?, ?, 1, 1, ?)`)
      .run(type, label, JSON.stringify(config));
  }
}

const afterSql: Partial<Record<number, (database: Database.Database) => void>> = {
  17: (database) => addColumns(database, "benchmark_item_results", ["metrics_json TEXT"]),
  18: (database) => {
    addColumns(database, "missions", ["version TEXT NOT NULL DEFAULT 'v1'", "current_phase_id TEXT"]);
    addColumns(database, "runs", ["phase_action_id TEXT"]);
  },
  20: (database) => {
    // Historical best-effort drops retain compatibility with older SQLite engines.
    for (const [table, column] of [["missions", "version"], ["missions", "current_phase_id"], ["runs", "phase_action_id"]]) {
      try {
        execIdempotent(database, `ALTER TABLE ${table} DROP COLUMN ${column}`);
      } catch (error) {
        if (!/near "DROP": syntax error/i.test(String(error))) throw error;
      }
    }
  },
  21: (database) => addColumns(database, "runs", ["composer_node_run_id TEXT"]),
  22: (database) => seedEmptyRegistry(database, "memory_providers", "label", "hindsight", "Hindsight", { host: "127.0.0.1", port: 9177, bank: "hermes" }),
  23: (database) => addColumns(database, "research_runs", ["config_json TEXT"]),
  24: (database) => {
    addColumns(database, "models", ["api_style TEXT"]);
    database.exec(`UPDATE models SET api_style = CASE
      WHEN provider = 'anthropic' THEN 'anthropic'
      WHEN base_url LIKE '%/anthropic' OR base_url LIKE '%/anthropic/%' THEN 'anthropic'
      ELSE 'openai' END WHERE api_style IS NULL`);
  },
  25: (database) => addColumns(database, "research_runs", ["composer_node_run_id TEXT"]),
  26: (database) => addColumns(database, "composer_runs", ["parent_node_run_id TEXT"]),
  27: (database) => seedEmptyRegistry(database, "frameworks", "name", "hermes", "Hermes", { home: null }),
};

/**
 * Apply the .sql migration that takes the schema to `version`, unless the
 * database is already there or past it. Returns the version the database is
 * at afterwards. A version the table does not know is a programming error and
 * throws, rather than quietly recording a step that never ran.
 */
export function applySqlMigration(database: Database.Database, migrationsDir: string, version: number): number {
  const entry = SQL_MIGRATIONS.find(([v]) => v === version);
  if (!entry) throw new Error(`sql-migrations: no migration takes the schema to version ${version}`);
  const current = getSchemaVersion(database);
  if (current >= version) return current;
  const path = join(migrationsDir, entry[1]);
  if (version === 15) execAdditiveMigrationFile(database, path);
  else execMigrationFile(database, path);
  afterSql[version]?.(database);
  setSchemaVersion(database, version);
  return version;
}

const at = (version: number) => (database: Database.Database, migrationsDir: string) =>
  applySqlMigration(database, migrationsDir, version);

export const applyDropGameTablesMigration = at(11);
export const applyAnalyticsEventsMigration = at(12);
export const applyChatMigration = at(13);
export const applyBenchmarksMigration = at(14);
export const applyBenchmarkConfigMigration = at(15);
export const applyBenchmarkCatalogMigration = at(16);
export const applyBenchGatewaysMigration = at(17);
export const applyMissionPhasesMigration = at(18);
export const applyDeepResearchMigration = at(19);
export const applyRetireMissionPhasesMigration = at(20);
export const applyComposerMigration = at(21);
export const applyMemoryProvidersMigration = at(22);
export const applyResearchOptionsMigration = at(23);
export const applyModelsApiStyleMigration = at(24);
export const applyResearchComposerLinkMigration = at(25);
export const applyComposerGroupLinkMigration = at(26);
export const applyFrameworksMigration = at(27);
export const applyArtifactsMigration = at(28);
export const applyRecroomLibraryMigration = at(29);
export const applyAgentProgressionMigration = at(31);
export const applyRetentionMigration = at(32);
export const applySpendPolicyMigration = at(33);
export const applyResearchUsageMigration = at(34);
export const applyResearchGatherMigration = at(36);
export const applyOperatorPrefsMigration = at(38);
export const applyModelsOriginMigration = at(39);
export const applyRunsSpendSourceMigration = at(40);
export const applyScheduleKindMigration = at(41);
export const applyFallbackIdentityMigration = at(42);

export const ANALYTICS_EVENTS_SCHEMA_VERSION = 12;
export const CHAT_SCHEMA_VERSION = 13;
export const AGENT_PROGRESSION_SCHEMA_VERSION = 31;
export const RETENTION_SCHEMA_VERSION = 32;
export const SPEND_POLICY_SCHEMA_VERSION = 33;
export const RESEARCH_USAGE_SCHEMA_VERSION = 34;
export const RESEARCH_GATHER_SCHEMA_VERSION = 36;
export const OPERATOR_PREFS_SCHEMA_VERSION = 38;
export const MODELS_ORIGIN_SCHEMA_VERSION = 39;
export const RUNS_SPEND_SOURCE_SCHEMA_VERSION = 40;
export const SCHEDULE_KIND_SCHEMA_VERSION = 41;
export const FALLBACK_IDENTITY_SCHEMA_VERSION = 42;
