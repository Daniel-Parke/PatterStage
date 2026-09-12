import { readFileSync } from "fs";
import { join } from "path";
import { applyModelsApiStyleMigration } from "../../src/lib/db/apply-models-api-style-migration";
import { applyNeutralColumnNames } from "../../src/lib/db/apply-neutral-column-names";
import { applyFallbackIdentityMigration, applyModelsOriginMigration, applyRunsSpendSourceMigration, applyScheduleKindMigration } from "../../src/lib/db/sql-migrations";

export const migrationsDir = join(__dirname, "..", "..", "src", "lib", "db", "migrations");

export const baselineSqlPath = join(migrationsDir, "001_baseline.sql");

/** A real better-sqlite3 handle, as opposed to the jest.config stub. */
export type RealDb = import("better-sqlite3").Database;

/** The shape every `apply*Migration` in `src/lib/db` shares. */
export type MigrationApplier = (database: RealDb, dir: string) => unknown;

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
  applyFallbackIdentityMigration(database, migrationsDir);
  database
    .prepare("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)")
    .run("schema_version", "3");
}

/**
 * An empty real in-memory SQLite database: no schema, no pragmas, nothing
 * (C8, T-0146).
 *
 * `jest.requireActual` against the on-disk path is what bypasses the stub: the
 * `^better-sqlite3$` mapper in jest.config.js does not match an absolute path,
 * and requireActual skips the manual mock. That one fact is the reason this
 * function exists, and it is now written down once.
 *
 * The eighteen PRE-BASELINE migration suites want exactly this and nothing
 * more: a bare `meta` table, `setSchemaVersion(db, N - 1)`, then the single
 * applier under test, so the assertion is that the migration CLIMBS from the
 * old schema. Handing them `openBaselineDb` would hand them the schema whose
 * absence is the point.
 */
export function openRealDb(): RealDb {
  const Database = jest.requireActual(
    join(process.cwd(), "node_modules", "better-sqlite3", "lib", "index.js"),
  ) as unknown as new (path: string) => RealDb;
  return new Database(":memory:");
}

/**
 * A real in-memory SQLite database on the baseline schema, with foreign keys
 * enforced and the given migrations applied in order (C8, T-0146).
 *
 * Forty-odd suites opened one by hand, and the four lines were the same four
 * lines every time: bypass the `better-sqlite3` stub that jest.config maps in,
 * open `:memory:`, turn foreign keys ON, run `execBaselineSchema`, then walk a
 * list of appliers with the migrations directory. Only that last list ever
 * differed, so it is the argument:
 *
 *   testDb = openBaselineDb([applyComposerMigration, applyComposerGroupLinkMigration]);
 *
 * `openRealDb` above is what bypasses the stub, and is the only place that
 * knows how.
 *
 * Foreign keys are ON and not negotiable here, because that is what a running
 * install does. A suite that needs them off says so afterwards on the handle it
 * gets back; a suite that seeds rows the schema would reject keeps its own
 * fixture rather than asking this helper to relax.
 */
export function openBaselineDb(migrations: MigrationApplier[] = []): RealDb {
  const database = openRealDb();
  database.pragma("foreign_keys = ON");
  execBaselineSchema(database);
  for (const apply of migrations) apply(database, migrationsDir);
  return database;
}

/**
 * The `@/lib/db` singleton, pointed at a test's own in-memory database (U1,
 * T-0115).
 *
 * This ten-line stanza was pasted identically into 38 test files. It lives here
 * now and each of them calls it in one line:
 *
 *   let testDb: import("better-sqlite3").Database | null = null;
 *   jest.mock("@/lib/db", () => require("../helpers/baseline-db").dbSingletonMock(() => testDb));
 *
 * `current` is a getter rather than the database itself, because `jest.mock` is
 * hoisted above every statement in the file: at the moment the factory is
 * built, `testDb` is still null, and it is `beforeEach` that fills it in. A
 * factory that captured the VALUE would hand every test a null database.
 *
 * `jest.requireActual("crypto")` rather than `require`, because a handful of
 * suites mock crypto to pin an id, and the singleton's `uuid` must keep
 * producing real ones regardless: it is what the repository layer writes as a
 * primary key.
 */
export function dbSingletonMock(
  current: () => import("better-sqlite3").Database | null,
  over: { uuid?: () => string; now?: () => string } = {},
) {
  const actualCrypto = jest.requireActual("crypto") as typeof import("crypto");
  return {
    getDb: () => current()!,
    inTransaction: <T,>(fn: () => T) => current()!.transaction(fn)(),
    uuid: over.uuid ?? (() => actualCrypto.randomUUID()),
    now: over.now ?? (() => new Date().toISOString()),
    ensureDb: () => undefined,
  };
}
