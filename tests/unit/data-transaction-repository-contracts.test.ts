/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports -- hoisted singleton fixture */
// T-0189 focused gaps only. Existing retention, progression, credentials, chat,
// research and stats controls are selected separately in the evidence manifest.
import { readFileSync } from "fs";
import { join } from "path";
import { openBaselineDb, type RealDb } from "../helpers/baseline-db";
import { applyOperatorPrefsMigration } from "@/lib/db/sql-migrations";
import { countByType, insertEvent } from "@/lib/analytics/analytics-repository";
import { getDashboardStats } from "@/lib/stats/stats-repository";
import { getSpendSummary } from "@/lib/spend/spend-summary";
let testDb: RealDb | null = null;
jest.mock("@/lib/db", () => require("../helpers/baseline-db").dbSingletonMock(() => testDb));
import { ensureDefaultCategories } from "@/lib/missions/mission-category-repository";
import { readOperatorPrefs, writeOperatorPref } from "@/lib/system/operator-prefs-repository";
const mockInitialiseSync = jest.fn();
jest.mock("@/lib/sync", () => ({ ensureSyncLayer: () => mockInitialiseSync() }));
import { triggerSyncOnce, _resetSyncDebounceForTests } from "@/lib/sessions/sessions-api-helpers";

beforeEach(() => { testDb = openBaselineDb([applyOperatorPrefsMigration]); });
afterEach(() => { testDb?.close(); testDb = null; });

describe("T-0189 actual default-category seeding", () => {
  it("an empty table receives the same eight category definitions as the immutable seed SQL", () => {
    const reference = openBaselineDb();
    try {
      const seedSql = readFileSync(join(process.cwd(), "src/lib/db/seeds/001_mission_categories.sql"), "utf8");
      reference.exec("DELETE FROM mission_categories");
      reference.exec(seedSql);
      testDb!.exec("DELETE FROM mission_categories");
      const projection = "SELECT id,seed_key,name,color,sort_order FROM mission_categories ORDER BY id";
      const expected = reference.prepare(projection).all();
      expect(expected).toHaveLength(8);
      const runtimeRead = jest.spyOn(jest.requireActual<typeof import("fs")>("fs"), "readFileSync");
      try {
        ensureDefaultCategories();
        expect(runtimeRead).not.toHaveBeenCalled();
      } finally { runtimeRead.mockRestore(); }
      expect(testDb!.prepare(projection).all()).toEqual(expected);
      const before = testDb!.prepare("SELECT * FROM mission_categories ORDER BY id").all();
      ensureDefaultCategories();
      expect(testDb!.prepare("SELECT * FROM mission_categories ORDER BY id").all()).toEqual(before);
    } finally { reference.close(); }
  });
  it("one existing custom category prevents seeding and remains untouched", () => {
    testDb!.exec("DELETE FROM mission_categories");
    testDb!.prepare("INSERT INTO mission_categories (id,name,color,sort_order,seed_key,created_at,updated_at) VALUES ('custom','User choice','violet',91,NULL,'2001-01-01','2001-02-02')").run();
    const before = testDb!.prepare("SELECT * FROM mission_categories").all();
    ensureDefaultCategories();
    expect(testDb!.prepare("SELECT * FROM mission_categories").all()).toEqual(before);
  });
  it("a missing category table returns safely without inventing a replacement table", () => {
    testDb!.pragma("foreign_keys = OFF");
    testDb!.exec("DROP TABLE mission_categories");
    expect(() => ensureDefaultCategories()).not.toThrow();
    expect(testDb!.prepare("SELECT name FROM sqlite_master WHERE name='mission_categories'").get()).toBeUndefined();
  });
});

describe("T-0189 three defensive display consumers retain synchronous fallbacks", () => {
  it("analytics returns its empty-map fallback while a write still propagates SQL failure", () => {
    expect(testDb!.prepare("SELECT name FROM sqlite_master WHERE name='analytics_events'").get()).toBeUndefined();
    expect(countByType()).toEqual({});
    expect(() => insertEvent({ eventType: "mission.dispatched", entityId: "oracle" })).toThrow();
  });
  it("dashboard still returns its existing token observations when optional analytics reads fail", () => {
    testDb!.prepare("INSERT INTO runs (id,status,usage_json) VALUES ('valid','completed',?)").run('{"inputTokens":2,"outputTokens":3,"totalTokens":5}');
    const result = getDashboardStats();
    expect(result.runs).toMatchObject({ total: 1, inputTokens: 2, outputTokens: 3, totalTokens: 5 });
  });
  it("spend summary keeps its display fallback when SQLite cannot read the spend window", () => {
    testDb!.exec("DROP TABLE runs");
    const summary = getSpendSummary();
    expect(summary.periods).toHaveLength(3);
    expect(summary.budgetSpentUsd).toBe(0);
    expect(summary.periods.map((row) => row.totalUsd)).toEqual([0, 0, 0]);
  });
});

describe("T-0189 session initialisation debounce remains timer based", () => {
  beforeEach(() => { jest.useFakeTimers(); _resetSyncDebounceForTests(); mockInitialiseSync.mockClear(); });
  afterEach(() => { _resetSyncDebounceForTests(); jest.clearAllTimers(); jest.useRealTimers(); });
  it("wall-clock movement alone does not expire a pending custom-delay timer", () => {
    triggerSyncOnce(123);
    expect(mockInitialiseSync).toHaveBeenCalledTimes(1);
    jest.setSystemTime(Date.now() + 100000);
    triggerSyncOnce(123);
    expect(mockInitialiseSync).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(122);
    triggerSyncOnce(123);
    expect(mockInitialiseSync).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(1);
    triggerSyncOnce(123);
    expect(mockInitialiseSync).toHaveBeenCalledTimes(2);
  });
  it("zero delay coalesces within the same turn and releases only after the timer runs", () => {
    triggerSyncOnce(0);
    triggerSyncOnce(0);
    expect(mockInitialiseSync).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(0);
    triggerSyncOnce(0);
    expect(mockInitialiseSync).toHaveBeenCalledTimes(2);
  });
});

describe("T-0189 preferences preserve existing values on refused writes", () => {
  it("invalid replacement and unknown keys preserve the previously saved preference map", () => {
    writeOperatorPref("sidebar.collapsed", true);
    writeOperatorPref("quests.skipped", ["2.3"]);
    const before = testDb!.prepare("SELECT * FROM operator_prefs ORDER BY key").all();
    expect(() => writeOperatorPref("sidebar.collapsed", "yes")).toThrow();
    expect(() => writeOperatorPref("oracle.unknown", true)).toThrow();
    expect(testDb!.prepare("SELECT * FROM operator_prefs ORDER BY key").all()).toEqual(before);
    expect(readOperatorPrefs()).toEqual({ "sidebar.collapsed": true, "quests.skipped": ["2.3"] });
  });
});
