import { readFileSync } from "fs";
import { join } from "path";
import { applyModelsApiStyleMigration } from "../../src/lib/db/apply-models-api-style-migration";

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
  database
    .prepare("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)")
    .run("schema_version", "3");
}
