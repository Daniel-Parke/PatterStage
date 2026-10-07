import type Database from "better-sqlite3";
import { applyTableRebuild } from "./apply-table-rebuild";

export const COMPOSER_REJECTED_SCHEMA_VERSION = 35;

// The historical SQL copies precisely this column set; drift must fail before DROP.
const EXPECTED_COLUMNS: Record<string, readonly string[]> = {
  composer_runs: ["id", "workflow_id", "status", "current_node_id", "input", "context_json", "profile_name", "error", "created_at", "updated_at", "completed_at", "parent_node_run_id"],
  composer_node_runs: ["id", "composer_run_id", "node_id", "attempt", "status", "run_id", "input", "output", "verdict_json", "error", "started_at", "completed_at", "created_at"],
};

export function applyComposerRejectedMigration(database: Database.Database, migrationsDir: string): number {
  return applyTableRebuild(database, migrationsDir, COMPOSER_REJECTED_SCHEMA_VERSION, "035_composer_rejected.sql", EXPECTED_COLUMNS);
}
