// ═══════════════════════════════════════════════════════════════
// sql-migrations — the migrations that are one .sql file each
//
// Seventeen of the chain's thirty-eight steps were the identical stanza in
// their own file: read the version, return if at or past N, exec one .sql
// file, set N. Twenty-eight to forty lines each to say `[N, "NNN_name.sql"]`.
// They are that table now, and one function (T-0129). The twenty-one steps
// that do real work (rebuilds behind shape guards, canonicalisations, the
// legacy column repair) keep their own files, because their bodies ARE the
// migration.
//
// The names survive below as one-line exports, so runMigrations reads as it
// did and the tests that call applyArtifactsMigration(db, dir) still can, and
// the version constants the tests read survive beside them.
// ═══════════════════════════════════════════════════════════════

import type Database from "better-sqlite3";
import { join } from "path";

import { getSchemaVersion, setSchemaVersion } from "@/lib/db-schema";
import { execMigrationFile } from "./apply-sql";

/** `[schema version it takes the database to, the file that does it]`, ascending. */
export const SQL_MIGRATIONS: ReadonlyArray<readonly [version: number, file: string]> = [
  [11, "011_drop_game_tables.sql"],
  [12, "012_analytics_events.sql"],
  [13, "013_chat.sql"],
  [14, "014_benchmarks.sql"],
  [16, "016_benchmark_catalog.sql"],
  [19, "019_deep_research.sql"],
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
];

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
  execMigrationFile(database, join(migrationsDir, entry[1]));
  setSchemaVersion(database, version);
  return version;
}

const at = (version: number) => (database: Database.Database, migrationsDir: string) =>
  applySqlMigration(database, migrationsDir, version);

export const applyDropGameTablesMigration = at(11);
export const applyAnalyticsEventsMigration = at(12);
export const applyChatMigration = at(13);
export const applyBenchmarksMigration = at(14);
export const applyBenchmarkCatalogMigration = at(16);
export const applyDeepResearchMigration = at(19);
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
