import { readFileSync } from "fs";
import { join } from "path";
import { applyModelsApiStyleMigration } from "../../src/lib/db/apply-models-api-style-migration";
import { applyNeutralColumnNames } from "../../src/lib/db/apply-neutral-column-names";
import { applyModelsOriginMigration } from "../../src/lib/db/apply-models-origin-migration";
import { applyRunsSpendSourceMigration } from "../../src/lib/db/apply-runs-spend-source-migration";
import { applyScheduleKindMigration } from "../../src/lib/db/apply-schedule-kind-migration";

const migrationsDir = join(__dirname, "..", "..", "src", "lib", "db", "migrations");

export const baselineSqlPath = join(migrationsDir, "001_baseline.sql");

/**
 * Apply the current squashed baseline schema, plus any additive column
 * migrations that the repository layer writes directly (so baseline-only repo
 * tests exercise the real schema). schema_version is pinned back to the
 * baseline (3) afterwards so version-sensitive callers are unaffected.
 */
export function execBaselineSchema(database: import("better-sqlite3").Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  database.exec(readFileSync(baselineSqlPath, "utf-8"));
  // models.api_style is added post-baseline (v24) but written by createModel/
  // upsertModel — apply it via the real applier so the column exists here too.
  applyModelsApiStyleMigration(database, migrationsDir);
  // 001_baseline creates agent_root.hermes_md and cron_jobs.hermes_job_id, which
  // v30 renames to framework_md / external_job_id. The repository layer reads and
  // writes the NEW names, so a baseline-only fixture would hand it a schema no
  // running install has. Same rule as api_style above: apply the real applier
  // rather than editing the historical baseline, which is a record of what
  // happened and not a description of the current schema.
  applyNeutralColumnNames(database);
  // models.origin and the last-imported pair are added post-baseline (v39) and
  // written by createModel/upsertModel, so a baseline-only fixture would hand
  // the repository a schema no running install has. Same rule as api_style.
  applyModelsOriginMigration(database, migrationsDir);
  // runs.spend_source and runs.story_id are added post-baseline (v40) and
  // written by createRun, so the same rule applies again. 040 classifies the
  // rows already there from runs.composer_node_run_id, which 001_baseline does
  // not create -- it is a guarded ALTER inside the v21 composer applier -- so
  // the column has to exist before 040 runs. Adding just the column keeps this
  // fixture's surface unchanged; pulling in the whole composer migration would
  // create four tables no baseline-only test asked for.
  const runsCols = database.prepare("PRAGMA table_info(runs)").all() as { name: string }[];
  if (!runsCols.some((c) => c.name === "composer_node_run_id")) {
    database.exec("ALTER TABLE runs ADD COLUMN composer_node_run_id TEXT");
  }
  applyRunsSpendSourceMigration(database, migrationsDir);
  // schedules.kind and schedules.script_name are added post-baseline (v41) and
  // written by createSchedule, so the same rule applies once more.
  applyScheduleKindMigration(database, migrationsDir);
  database
    .prepare("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)")
    .run("schema_version", "3");
}
