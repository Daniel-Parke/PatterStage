import type Database from "better-sqlite3";
import { applyTableRebuild } from "./apply-table-rebuild";

export const COMPOSER_NODE_CANCELLED_SCHEMA_VERSION = 37;

// The historical SQL copies precisely this column set; drift must fail before DROP.
const EXPECTED_COLUMNS: Record<string, readonly string[]> = {
  composer_node_runs: ["id", "composer_run_id", "node_id", "attempt", "status", "run_id", "input", "output", "verdict_json", "error", "started_at", "completed_at", "created_at"],
};

export function applyComposerNodeCancelledMigration(database: Database.Database, migrationsDir: string): number {
  return applyTableRebuild(database, migrationsDir, COMPOSER_NODE_CANCELLED_SCHEMA_VERSION, "037_composer_node_cancelled.sql", EXPECTED_COLUMNS);
}
