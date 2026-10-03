/**
 * @jest-environment node
 *
 * `latestEventPerEntity` against a real in-memory SQLite database, the same way
 * analytics-repository.test.ts does it, because two things here are properties
 * of SQLite rather than of the code:
 *
 *   - one row per entity, and it must be the LATEST one. The query leans on
 *     SQLite's documented rule that bare columns beside a lone max() come from
 *     the row that produced the maximum; a hand-rolled reduce in JavaScript
 *     would pass a mocked database and prove nothing about the real one.
 *   - `created_at` is written by the column DEFAULT `datetime('now')`, which is
 *     "2026-09-06 01:00:00": UTC, with a space, and no zone marker. `new Date()`
 *     reads that as LOCAL time, so on any machine east of Greenwich the last run
 *     lands in the future and every "how long ago" reads "never". The reader
 *     hands back an ISO instant instead.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
import type Database from "better-sqlite3";
import { readFileSync } from "fs";
import { join } from "path";

import type * as AnalyticsRepo from "@/lib/analytics/analytics-repository";

const migrationsDir = join(__dirname, "..", "..", "src", "lib", "db", "migrations");
const baselineSql = readFileSync(join(migrationsDir, "001_baseline.sql"), "utf-8");
const analyticsSql = readFileSync(join(migrationsDir, "012_analytics_events.sql"), "utf-8");

function makeDb(): Database.Database {
  const RealDatabase = require("better-sqlite3/lib/index.js") as typeof import("better-sqlite3");
  const db = new (RealDatabase as unknown as new (path: string) => Database.Database)(":memory:");
  db.exec(baselineSql);
  db.exec(analyticsSql);
  return db;
}

let seq = 0;
function insert(
  db: Database.Database,
  row: { type: string; entityId: string; entityType?: string; at: string; metadata?: unknown },
): void {
  db.prepare(
    `INSERT INTO analytics_events (id, event_type, entity_type, entity_id, metadata_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    `e${seq++}`,
    row.type,
    row.entityType ?? "script",
    row.entityId,
    row.metadata === undefined ? null : JSON.stringify(row.metadata),
    row.at,
  );
}

describe("latestEventPerEntity", () => {
  let db: Database.Database;
  let repo: typeof AnalyticsRepo;

  beforeEach(() => {
    db = makeDb();
    seq = 0;
    jest.resetModules();
    jest.doMock("@/lib/db", () => {
      const actual = jest.requireActual("@/lib/db");
      return { ...actual, getDb: () => db, inTransaction: (fn: () => unknown) => fn() };
    });
    repo = require("@/lib/analytics/analytics-repository") as typeof AnalyticsRepo;
  });

  afterEach(() => {
    db.close();
    jest.resetModules();
    jest.dontMock("@/lib/db");
  });

  it("returns the most recent row for each entity, not the first", () => {
    insert(db, { type: "script.run", entityId: "backup.mjs", at: "2026-09-01 01:00:00", metadata: { exitCode: 0 } });
    insert(db, { type: "script.run", entityId: "backup.mjs", at: "2026-09-03 01:00:00", metadata: { exitCode: 2 } });
    insert(db, { type: "script.run", entityId: "ping.mjs", at: "2026-09-02 01:00:00", metadata: { exitCode: 0 } });

    const rows = repo.latestEventPerEntity("script", ["script.run"]);
    const byId = Object.fromEntries(rows.map((r) => [r.entityId, r]));

    expect(rows).toHaveLength(2);
    expect(JSON.parse(byId["backup.mjs"].metadataJson!)).toEqual({ exitCode: 2 });
    expect(JSON.parse(byId["ping.mjs"].metadataJson!)).toEqual({ exitCode: 0 });
  });

  it("hands back an instant, not a local-time reading of a UTC string", () => {
    insert(db, { type: "script.run", entityId: "backup.mjs", at: "2026-09-03 01:00:00" });

    const [row] = repo.latestEventPerEntity("script", ["script.run"]);

    expect(row.createdAt).toBe("2026-09-03T01:00:00Z");
    expect(new Date(row.createdAt).getTime()).toBe(Date.parse("2026-09-03T01:00:00Z"));
  });

  it("considers every type it was asked for, and picks the latest across them", () => {
    insert(db, { type: "script.run", entityId: "backup.mjs", at: "2026-09-01 01:00:00" });
    insert(db, { type: "script.run_not_started", entityId: "backup.mjs", at: "2026-09-04 01:00:00" });

    const [row] = repo.latestEventPerEntity("script", ["script.run", "script.run_not_started"]);

    expect(row.eventType).toBe("script.run_not_started");
  });

  it("ignores events about anything else", () => {
    insert(db, { type: "script.run", entityId: "backup.mjs", at: "2026-09-01 01:00:00" });
    insert(db, { type: "mission.completed", entityId: "m1", entityType: "mission", at: "2026-09-05 01:00:00" });
    insert(db, { type: "script.saved", entityId: "backup.mjs", at: "2026-09-06 01:00:00" });

    const rows = repo.latestEventPerEntity("script", ["script.run"]);

    expect(rows.map((r) => r.entityId)).toEqual(["backup.mjs"]);
    expect(rows[0].eventType).toBe("script.run");
  });

  it("answers with nothing rather than throwing when asked for no types", () => {
    insert(db, { type: "script.run", entityId: "backup.mjs", at: "2026-09-01 01:00:00" });

    expect(repo.latestEventPerEntity("script", [])).toEqual([]);
  });
});
