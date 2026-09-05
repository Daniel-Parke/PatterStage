// ═══════════════════════════════════════════════════════════════
// db-schema.ts — SQLite schema version helpers
// These are extracted to a separate module so they can be imported
// by migration files without being intercepted by the global
// @/lib/db mock in Jest tests.
// ═══════════════════════════════════════════════════════════════

const SCHEMA_VERSION_KEY = "schema_version";

/**
 * The terminal `schema_version` of the hand-wired migration ladder in
 * `runMigrations()`: the version a fully migrated database ends on.
 *
 * WHY IT LIVES HERE and not in the `@/lib/db` entry module. `tests/jest.setup.ts`
 * mocks `@/lib/db` with a fixed factory, so a constant exported from there reads
 * as `undefined` inside the migration tests. Hardcoding the number into that mock
 * instead would recreate the exact drift this constant exists to kill. This module
 * is never mocked, so the number survives into the tests that check it.
 *
 * WHY IT IS DECLARED rather than re-exported from the last applier. That applier
 * imports this module for `getSchemaVersion` / `setSchemaVersion`, so importing it
 * back would be a cycle. The duplication is made safe by
 * `tests/unit/run-migrations-upgrade.integration.test.ts`, which asserts this
 * equals `RUNS_SPEND_SOURCE_SCHEMA_VERSION` (the last applier's gate), that the
 * last applier's gate is exactly one above the one before it, and that it equals
 * the highest-numbered file in `src/lib/db/migrations/`.
 *
 * Raising the head means bumping this in the same commit as the applier that
 * raises it. `docs/running/migration.md` carries the full going-forward rule.
 */
export const MIGRATION_HEAD_SCHEMA_VERSION = 41;

export function getSchemaVersion(database: { prepare: (sql: string) => { get: (key: string) => { value: string } | undefined } }): number {
  try {
    const row = database
      .prepare("SELECT value FROM meta WHERE key = ?")
      .get(SCHEMA_VERSION_KEY) as { value: string } | undefined;
    return row ? parseInt(row.value, 10) : 0;
  } catch {
    return 0;
  }
}

export function setSchemaVersion(database: { prepare: (sql: string) => { run: (key: string, value: string) => void } }, version: number): void {
  database
    .prepare("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)")
    .run(SCHEMA_VERSION_KEY, String(version));
}
