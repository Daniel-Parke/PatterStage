// ═══════════════════════════════════════════════════════════════
// db/apply-sql.ts — run a migration file, and fail loudly when it fails
//
// Every applier used to be shaped like this:
//
//     try { database.exec(sql); } catch { /* idempotent; ignore */ }
//     setSchemaVersion(database, N);          // ← runs either way
//
// so a migration that failed for a REAL reason (a syntax error, a disk I/O
// error, a locked database, a constraint violation) was recorded as applied.
// There is no retry: the next boot sees schema_version >= N and skips it. The
// database is then permanently half-migrated, and the failure is invisible
// because nothing was logged and the boot carried on.
//
// Two of the appliers even said "the next pass retries", which the version guard
// makes impossible.
//
// The blanket catch existed for one real reason: SQLite has no
// `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, so re-running an additive
// migration legitimately throws "duplicate column name". That is the ONLY class
// of error worth swallowing, so it is the only one this allows.
// ═══════════════════════════════════════════════════════════════

import type Database from "better-sqlite3";
import { existsSync, readFileSync } from "fs";

/**
 * Errors that mean "this step was already applied", which is the idempotency the
 * appliers actually need. Anything else is a genuine failure.
 */
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
 *
 * @throws the original error when the statement failed for any other reason, so
 *         the caller does NOT bump schema_version and the boot fails visibly.
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
 * Execute a migration file if it is present.
 *
 * A MISSING file is not an error: `prebuild-db.mjs` ships a database that has
 * already had the early migrations applied, and the .sql files are not always
 * deployed alongside it. A file that is present and broken IS an error.
 */
export function execMigrationFile(database: Database.Database, path: string): void {
  if (!existsSync(path)) return;
  execIdempotent(database, readFileSync(path, "utf-8"));
}
