import { readFileSync } from "fs";
import { join } from "path";
import { applyModelsApiStyleMigration } from "../../src/lib/db/apply-models-api-style-migration";
import { applyNeutralColumnNames } from "../../src/lib/db/apply-neutral-column-names";
import { applyModelsOriginMigration } from "../../src/lib/db/apply-models-origin-migration";

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
  database
    .prepare("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)")
    .run("schema_version", "3");
}
