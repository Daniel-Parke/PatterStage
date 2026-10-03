/**
 * @jest-environment node
 *
 * analytics-repository against a real in-memory SQLite DB (baseline + the v12
 * analytics_events migration). `@/lib/db` is mocked so the repo's getDb() hits the
 * test DB and inTransaction runs the callback directly.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
import type Database from "better-sqlite3";
import { readFileSync } from "fs";
import { join } from "path";

import type * as AnalyticsRepo from "@/lib/analytics/analytics-repository";

const migrationsDir = join(__dirname, "..", "..", "src", "lib", "db", "migrations");
const baselineSql = readFileSync(join(migrationsDir, "001_baseline.sql"), "utf-8");
const analyticsSql = readFileSync(join(migrationsDir, "012_analytics_events.sql"), "utf-8");

function loadRealBetterSqlite3(): typeof import("better-sqlite3") {
  return require("better-sqlite3/lib/index.js") as typeof import("better-sqlite3");
}

interface TestDatabase {
  db: Database.Database;
  close: () => void;
}

function makeTestDatabase(): TestDatabase {
  const RealDatabase = loadRealBetterSqlite3();
  const db = new (RealDatabase as unknown as new (path: string) => Database.Database)(":memory:");
  db.pragma("foreign_keys = ON");
  db.exec(baselineSql);
  db.exec(analyticsSql);
  return { db, close: () => db.close() };
}

let _seq = 0;
function insertAt(
  db: Database.Database,
  type: string,
  dayOffset: number,
  opts: { entityId?: string; profile?: string } = {},
): void {
  db.prepare(
    `INSERT INTO analytics_events (id, event_type, entity_type, entity_id, profile, created_at)
     VALUES (?, ?, NULL, ?, ?, datetime('now', ?))`,
  ).run(`e${_seq++}`, type, opts.entityId ?? null, opts.profile ?? null, `-${dayOffset} days`);
}

describe("analytics-repository", () => {
  let tdb: TestDatabase;
  let repo: typeof AnalyticsRepo;

  beforeEach(() => {
    tdb = makeTestDatabase();
    _seq = 0;
    jest.resetModules();
    jest.doMock("@/lib/db", () => {
      const actual = jest.requireActual("@/lib/db");
      return { ...actual, getDb: () => tdb.db, inTransaction: (fn: () => unknown) => fn() };
    });
    repo = require("@/lib/analytics/analytics-repository") as typeof AnalyticsRepo;
  });

  afterEach(() => {
    tdb.close();
    jest.resetModules();
    jest.dontMock("@/lib/db");
  });

  it("insertEvent + countByType groups across types", () => {
    repo.insertEvent({ eventType: "mission.dispatched", entityType: "mission", entityId: "m1" });
    repo.insertEvent({ eventType: "mission.dispatched", entityType: "mission", entityId: "m2" });
    repo.insertEvent({ eventType: "story.created", entityType: "story", entityId: "s1" });

    expect(repo.countByType()).toEqual({ "mission.dispatched": 2, "story.created": 1 });
  });

  it("countByTypeSince respects the day window boundary", () => {
    insertAt(tdb.db, "chat.message_sent", 1); // yesterday — in
    insertAt(tdb.db, "chat.message_sent", 6); // -6d — in a 7d window
    insertAt(tdb.db, "chat.message_sent", 10); // -10d — out

    expect(repo.countByTypeSince(7)["chat.message_sent"]).toBe(2);
    expect(repo.countByTypeSince(30)["chat.message_sent"]).toBe(3);
  });

  it("timeseries gap-fills the window and counts today's events", () => {
    repo.insertEvent({ eventType: "schedule.fired", entityId: "sc1" });
    repo.insertEvent({ eventType: "schedule.fired", entityId: "sc1" });

    const series = repo.timeseries("schedule.fired", 7);
    expect(series).toHaveLength(7);
    expect(series[series.length - 1].value).toBe(2); // today
    expect(series.reduce((a, p) => a + p.value, 0)).toBe(2);
  });

  it("distinctActiveDays + maxCountInSingleDay reflect per-day grouping", () => {
    insertAt(tdb.db, "mission.completed", 0);
    insertAt(tdb.db, "mission.completed", 0);
    insertAt(tdb.db, "mission.completed", 0);
    insertAt(tdb.db, "mission.completed", 2);

    expect(repo.distinctActiveDays().length).toBe(2);
    expect(repo.maxCountInSingleDay("mission.completed")).toBe(3);
  });

  it("topEntities + distinctProfileCount + distinctEventTypeCount", () => {
    repo.insertEvent({ eventType: "skill.toggled", entityId: "git", profile: "bob" });
    repo.insertEvent({ eventType: "skill.toggled", entityId: "git", profile: "bob" });
    repo.insertEvent({ eventType: "skill.toggled", entityId: "web", profile: "alice" });
    repo.insertEvent({ eventType: "personality.changed", entityId: "p1", profile: "alice" });

    expect(repo.topEntities("skill.toggled", 5)[0]).toEqual({ entityId: "git", count: 2 });
    expect(repo.distinctProfileCount("skill.toggled")).toBe(2);
    expect(repo.distinctEventTypeCount()).toBe(2);
  });

  it("countByTypeAndHour returns a 24-length array summing to the event count", () => {
    repo.insertEvent({ eventType: "chat.message_sent" });
    repo.insertEvent({ eventType: "chat.message_sent" });
    const hours = repo.countByTypeAndHour("chat.message_sent");
    expect(hours).toHaveLength(24);
    expect(hours.reduce((a, b) => a + b, 0)).toBe(2);
  });

  it("empty DB yields zeros, not errors", () => {
    expect(repo.countByType()).toEqual({});
    expect(repo.countByTypeSince(30)).toEqual({});
    expect(repo.distinctActiveDays()).toEqual([]);
    expect(repo.topEntities("mission.dispatched")).toEqual([]);
    expect(repo.maxCountInSingleDay("mission.dispatched")).toBe(0);
    expect(repo.distinctProfileCount()).toBe(0);
    expect(repo.distinctEventTypeCount()).toBe(0);
    expect(repo.timeseries("mission.dispatched", 5)).toHaveLength(5);
  });
});
