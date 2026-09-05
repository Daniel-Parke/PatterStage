/** @jest-environment node */
// Verifies the v12 analytics_events migration against REAL SQLite (the global
// better-sqlite3 mock is bypassed via requireActual). Covers: table + indexes
// created, schema_version bumped to 12, idempotency, and the version-guard
// early-return. The full-chain wiring (runMigrations actually calls the applier)
// is guarded separately in run-migrations-upgrade.integration.test.ts.

import { join } from "path";
import type DatabaseNs from "better-sqlite3";
import {
  applyAnalyticsEventsMigration,
  ANALYTICS_EVENTS_SCHEMA_VERSION,
} from "@/lib/db/apply-analytics-events-migration";
import { getSchemaVersion, setSchemaVersion } from "@/lib/db-schema";

type RealDb = DatabaseNs.Database;

const Database = jest.requireActual(
  join(process.cwd(), "node_modules", "better-sqlite3", "lib", "index.js"),
) as unknown as new (path: string) => RealDb;

const migrationsDir = join(process.cwd(), "src", "lib", "db", "migrations");

function tableNames(db: RealDb): string[] {
  return (
    db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]
  ).map((r) => r.name);
}
function indexNames(db: RealDb): string[] {
  return (
    db.prepare("SELECT name FROM sqlite_master WHERE type='index'").all() as { name: string }[]
  ).map((r) => r.name);
}
function withMeta(db: RealDb): RealDb {
  db.exec("CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);");
  return db;
}

describe("analytics_events migration (v12, real SQLite)", () => {
  it("creates the table + all three indexes and bumps schema_version to 12", () => {
    const db = withMeta(new Database(":memory:"));
    setSchemaVersion(db, 11);

    applyAnalyticsEventsMigration(db, migrationsDir);

    expect(tableNames(db)).toContain("analytics_events");
    expect(indexNames(db)).toEqual(
      expect.arrayContaining([
        "idx_analytics_events_type",
        "idx_analytics_events_created",
        "idx_analytics_events_type_created",
      ]),
    );
    expect(getSchemaVersion(db)).toBe(ANALYTICS_EVENTS_SCHEMA_VERSION);
    expect(ANALYTICS_EVENTS_SCHEMA_VERSION).toBe(12);
    db.close();
  });

  it("accepts an insert with the documented column shape", () => {
    const db = withMeta(new Database(":memory:"));
    setSchemaVersion(db, 11);
    applyAnalyticsEventsMigration(db, migrationsDir);

    expect(() =>
      db
        .prepare(
          "INSERT INTO analytics_events (id, event_type, entity_type, entity_id, profile, metadata_json) VALUES (?,?,?,?,?,?)",
        )
        .run("e1", "mission.dispatched", "mission", "m1", "bob", '{"tokens":5}'),
    ).not.toThrow();

    const row = db
      .prepare("SELECT event_type, created_at FROM analytics_events WHERE id = 'e1'")
      .get() as { event_type: string; created_at: string };
    expect(row.event_type).toBe("mission.dispatched");
    expect(row.created_at).toBeTruthy(); // default datetime('now') applied
    db.close();
  });

  it("is idempotent — a second apply is a no-op and does not throw", () => {
    const db = withMeta(new Database(":memory:"));
    setSchemaVersion(db, 11);

    applyAnalyticsEventsMigration(db, migrationsDir);
    expect(() => applyAnalyticsEventsMigration(db, migrationsDir)).not.toThrow();
    expect(getSchemaVersion(db)).toBe(12);
    db.close();
  });

  it("version-guards: a DB already at v12 is left untouched (early return)", () => {
    const db = withMeta(new Database(":memory:"));
    setSchemaVersion(db, 12);

    const result = applyAnalyticsEventsMigration(db, migrationsDir);

    // Guard fired before exec → table NOT created (proves the >= guard works).
    expect(result).toBe(12);
    expect(tableNames(db)).not.toContain("analytics_events");
    db.close();
  });
});
