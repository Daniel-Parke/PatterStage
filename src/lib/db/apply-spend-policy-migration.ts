// ═══════════════════════════════════════════════════════════════
// apply-spend-policy-migration.ts
//
// Creates the operator's optional provider-spend budget (033). Version guarded
// at schema_version 33, wired LAST in runMigrations.
//
// Uses execMigrationFile, so a genuine SQL failure propagates and the version is
// NOT bumped. See src/lib/db/apply-sql.ts for why that matters.
//
// This applier arms nothing. The row it seeds carries limit_usd NULL and
// hard_stop 0 on every install, fresh and upgraded alike, and the seed is
// INSERT OR IGNORE so a re-run cannot overwrite a figure the operator already
// set. An upgrade is not a moment at which anybody's work starts refusing to
// dispatch.
// ═══════════════════════════════════════════════════════════════

import type Database from "better-sqlite3";
import { join } from "path";
import { getSchemaVersion, setSchemaVersion } from "@/lib/db-schema";
import { execMigrationFile } from "./apply-sql";

/**
 * The head of the migration ladder as of T-0021.
 * `MIGRATION_HEAD_SCHEMA_VERSION` in `src/lib/db-schema.ts` must equal this, and
 * `tests/unit/run-migrations-upgrade.integration.test.ts` asserts it does.
 */
export const SPEND_POLICY_SCHEMA_VERSION = 33;

export function applySpendPolicyMigration(
  database: Database.Database,
  migrationsDir: string,
): number {
  const current = getSchemaVersion(database);
  if (current >= SPEND_POLICY_SCHEMA_VERSION) return current;

  execMigrationFile(database, join(migrationsDir, "033_spend_policy.sql"));

  setSchemaVersion(database, SPEND_POLICY_SCHEMA_VERSION);
  return SPEND_POLICY_SCHEMA_VERSION;
}
