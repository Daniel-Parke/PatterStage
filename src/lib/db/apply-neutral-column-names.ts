// ═══════════════════════════════════════════════════════════════
// apply-neutral-column-names.ts
//
// Takes the vendor's name out of two columns in tables PatterStage owns
// (030). Version guarded at schema_version 30, wired LAST in runMigrations.
//
//   agent_root.hermes_md      -> framework_md
//   cron_jobs.hermes_job_id   -> external_job_id
//
// WHY THIS ONE IS NOT execMigrationFile.
//
// Every other applier runs a .sql file and lets a genuine failure propagate, so
// the version is not bumped. That is right for CREATE and for ADD COLUMN, both of
// which are naturally idempotent or can be made so. `ALTER TABLE ... RENAME
// COLUMN` is neither: it throws "no such column" on a second run, and this repo
// has table-creating paths that do not go through the migration chain at all
// (db/profiles-tools-parity-ensure.ts and scripts/tooling/db-schema-ensure.mjs
// both CREATE TABLE IF NOT EXISTS agent_root). Ordering between those and this
// migration is not guaranteed on every install shape.
//
// So each rename is guarded on the actual current shape, read from PRAGMA
// table_info: rename only when the OLD name is present and the NEW one is not.
// That makes the migration correct under every ordering, and a no-op on a DB that
// already has the new names. A rename that genuinely fails still throws, so the
// version is still not bumped on a real fault.
//
// The historical migrations (001, 002) are deliberately NOT edited. They created
// `hermes_md`, and that is what happened. Migration history is a record, not a
// description of the current schema.
// ═══════════════════════════════════════════════════════════════

import type Database from "better-sqlite3";
import { getSchemaVersion, setSchemaVersion } from "@/lib/db-schema";

/**
 * @public This applier held the head until T-0016 appended v31. It keeps its
 * exported gate because `tests/unit/run-migrations-upgrade.integration.test.ts`
 * asserts the new head sits exactly one above it, which is what
 * `docs/running/migration.md`'s "schema_version strictly increases" rule looks like from
 * the outside: it catches a later migration that reuses or skips a number.
 */
export const NEUTRAL_COLUMN_NAMES_SCHEMA_VERSION = 30;

function columnExists(database: Database.Database, table: string, column: string): boolean {
  try {
    const rows = database.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    return rows.some((r) => r.name === column);
  } catch {
    // Table absent on a partial/minimal schema. Nothing to rename.
    return false;
  }
}

/**
 * Rename `from` to `to` when, and only when, that is the change still needed.
 *
 * Returns true if it renamed. A missing table, an already-renamed column, or a
 * DB carrying both (which should be impossible, and is left alone rather than
 * guessed at) all yield false without touching anything.
 */
function renameColumnIfNeeded(
  database: Database.Database,
  table: string,
  from: string,
  to: string,
): boolean {
  const hasOld = columnExists(database, table, from);
  const hasNew = columnExists(database, table, to);
  if (!hasOld || hasNew) return false;
  database.exec(`ALTER TABLE ${table} RENAME COLUMN ${from} TO ${to};`);
  return true;
}

/**
 * Neutralise the two vendor-named columns. Idempotent and order-independent.
 */
export function applyNeutralColumnNames(database: Database.Database): number {
  const current = getSchemaVersion(database);
  if (current >= NEUTRAL_COLUMN_NAMES_SCHEMA_VERSION) return current;

  renameColumnIfNeeded(database, "agent_root", "hermes_md", "framework_md");
  const renamedJobId = renameColumnIfNeeded(
    database,
    "cron_jobs",
    "hermes_job_id",
    "external_job_id",
  );

  // The index follows the column. SQLite rewrites an index's column REFERENCE on
  // rename but keeps its old name, so without this the schema would carry an
  // index called idx_cron_hermes_id over external_job_id: exactly the stale
  // signpost this migration exists to remove.
  if (renamedJobId || columnExists(database, "cron_jobs", "external_job_id")) {
    try {
      database.exec(`
        DROP INDEX IF EXISTS idx_cron_hermes_id;
        CREATE INDEX IF NOT EXISTS idx_cron_external_id
          ON cron_jobs(external_job_id) WHERE external_job_id IS NOT NULL;
      `);
    } catch {
      // An index is an optimisation, not a correctness requirement. A minimal
      // schema without cron_jobs must not fail the whole migration over one.
    }
  }

  setSchemaVersion(database, NEUTRAL_COLUMN_NAMES_SCHEMA_VERSION);
  return NEUTRAL_COLUMN_NAMES_SCHEMA_VERSION;
}
