// ═══════════════════════════════════════════════════════════════
// db/apply-sql.ts — run a migration file, and fail loudly when it fails
//
// Every applier swallowed every error and then set schema_version anyway, so a
// migration that failed for a REAL reason was recorded as applied, never
// retried, and invisible. The catch existed because SQLite has no `ADD COLUMN
// IF NOT EXISTS`, so re-running an additive migration throws "duplicate column
// name": the ONLY class of error worth swallowing, and the only one allowed here.
// ═══════════════════════════════════════════════════════════════

import type Database from "better-sqlite3";
import { existsSync, readFileSync } from "fs";

/** Errors that mean "already applied", the idempotency the appliers need; anything else is genuine. */
export function isAlreadyAppliedError(error: unknown): boolean {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return (
    message.includes("duplicate column name") ||
    message.includes("already exists") ||
    // DROP COLUMN on a SQLite too old to support it, or a column already dropped
    message.includes("no such column") ||
    message.includes("cannot drop")
  );
}

/**
 * Execute SQL, swallowing only already-applied errors.
 * @throws the original error otherwise, so the caller does NOT bump schema_version and the boot fails visibly.
 */
export function execIdempotent(database: Database.Database, sql: string): void {
  try {
    database.exec(sql);
  } catch (error) {
    if (isAlreadyAppliedError(error)) return;
    throw error;
  }
}

/**
 * Execute a migration file if present. A MISSING file is not an error:
 * `prebuild-db.mjs` ships a database with the early migrations applied and the
 * .sql files are not always deployed beside it. Present and broken IS an error.
 */
export function execMigrationFile(database: Database.Database, path: string): void {
  if (!existsSync(path)) return;
  execIdempotent(database, readFileSync(path, "utf-8"));
}
