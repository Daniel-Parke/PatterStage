/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * U15 · One driver for the SQL migrations.
 *
 * Thirty-eight migration wrappers, and seventeen of them the identical
 * stanza: read the version, return if at or past N, exec one .sql file, set
 * N. Twenty-eight to forty lines each to say `[N, "NNN_name.sql"]`. The
 * seventeen become one table and one function; the twenty-one that do real
 * work (rebuilds with shape guards, canonicalisations, repairs) keep their
 * files, because their bodies ARE the migration.
 *
 * The names survive as one-line exports, so the tests that call
 * applyArtifactsMigration(db, dir) still can, and the version constants the
 * tests read survive beside them. What goes is the stanza, seventeen times.
 */

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { getSchemaVersion, setSchemaVersion } from "@/lib/db-schema";
import { SQL_MIGRATIONS, applySqlMigration } from "@/lib/db/sql-migrations";

const ROOT = join(__dirname, "..", "..");
const migrationsDir = join(ROOT, "src", "lib", "db", "migrations");

function loadRealBetterSqlite3(): typeof import("better-sqlite3") {
  return require("better-sqlite3/lib/index.js") as typeof import("better-sqlite3");
}

describe("U15 · the table", () => {
  it("names seventeen migrations, ascending, each a real file whose prefix is its version", () => {
    expect(SQL_MIGRATIONS).toHaveLength(17);
    const versions = SQL_MIGRATIONS.map(([v]) => v);
    expect([...versions].sort((a, b) => a - b)).toEqual(versions);
    expect(new Set(versions).size).toBe(versions.length);
    for (const [version, file] of SQL_MIGRATIONS) {
      expect({ file, exists: existsSync(join(migrationsDir, file)) }).toEqual({ file, exists: true });
      expect({ file, prefix: Number(file.slice(0, 3)) }).toEqual({ file, prefix: version });
    }
  });

  it("the seventeen stanza files are gone and the twenty-one workers remain", () => {
    const files = readdirSync(join(ROOT, "src", "lib", "db")).filter((f) => f.startsWith("apply-"));
    for (const stanza of [
      "apply-artifacts-migration.ts",
      "apply-benchmark-catalog-migration.ts",
      "apply-benchmarks-migration.ts",
      "apply-deep-research-migration.ts",
      "apply-drop-game-tables-migration.ts",
      "apply-recroom-library-migration.ts",
      "apply-agent-progression-migration.ts",
      "apply-analytics-events-migration.ts",
      "apply-chat-migration.ts",
      "apply-models-origin-migration.ts",
      "apply-operator-prefs-migration.ts",
      "apply-research-gather-migration.ts",
      "apply-research-usage-migration.ts",
      "apply-retention-migration.ts",
      "apply-runs-spend-source-migration.ts",
      "apply-schedule-kind-migration.ts",
      "apply-spend-policy-migration.ts",
    ]) {
      expect({ [stanza]: files.includes(stanza) }).toEqual({ [stanza]: false });
    }
    for (const worker of [
      "apply-composer-rejected-migration.ts",
      "apply-cron-schedule-canonicalisation.ts",
      "apply-neutral-column-names.ts",
      "apply-sql.ts",
    ]) {
      expect({ [worker]: files.includes(worker) }).toEqual({ [worker]: true });
    }
  });
});

describe("U15 · the driver", () => {
  function freshDb() {
    const Database = loadRealBetterSqlite3();
    const db = new (Database as unknown as new (path: string) => import("better-sqlite3").Database)(":memory:");
    db.pragma("foreign_keys = ON");
    db.exec("CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);");
    const { readFileSync } = require("node:fs") as typeof import("node:fs");
    db.exec(readFileSync(join(migrationsDir, "001_baseline.sql"), "utf-8"));
    return db;
  }

  it("applies a version once, records it, and is a no-op after", () => {
    const db = freshDb();
    setSchemaVersion(db, 11);
    expect(applySqlMigration(db, migrationsDir, 12)).toBe(12);
    expect(getSchemaVersion(db)).toBe(12);
    const table = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='analytics_events'").get();
    expect(table).toBeTruthy();
    expect(applySqlMigration(db, migrationsDir, 12)).toBe(12);
  });

  it("refuses to apply a version the table does not know", () => {
    const db = freshDb();
    setSchemaVersion(db, 11);
    expect(() => applySqlMigration(db, migrationsDir, 999)).toThrow(/999/);
  });

  it("leaves a database already past the version alone", () => {
    const db = freshDb();
    setSchemaVersion(db, 20);
    expect(applySqlMigration(db, migrationsDir, 12)).toBe(20);
    expect(getSchemaVersion(db)).toBe(20);
  });
});
