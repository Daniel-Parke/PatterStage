/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports -- better-sqlite3's package root is not newable under the jest transform, and the quest modules do not exist yet */

// ═══════════════════════════════════════════════════════════════
// B17 oracle, the latch: a completed quest never un-completes.
//
// Contract §3 and §5. Every quest number in PatterStage is DERIVED on read
// from `analytics_events`, and ADR-0009 deletes those rows on a schedule. The
// reviewer's ratified block therefore rules quest completion a high-water
// mark, latched in `operator_prefs` under the `quests.completedAt` key that
// B3's migration 038 already ships. This file is the proof of that rule, in
// three parts:
//
//   (A) the pure evaluator: a latched quest stays complete against metrics
//       that have gone back to zero, its stamp is when it was FIRST seen, and
//       the merged map only ever grows;
//   (B) the repository: readQuestLatch / writeQuestCompletions over the real
//       operator_prefs table, defensive on a database that has none;
//   (C) where the write happens — beside the progression capture in
//       GET /api/stats, inside the read-only guard, in a try of its own.
//
// Written before src/lib/quests/ exists.
// ═══════════════════════════════════════════════════════════════

import { readFileSync } from "fs";
import { join } from "path";

import type { RawMetrics } from "@/lib/stats/derive";

// ── the shapes the contract names ───────────────────────────────

interface QuestLatch {
  completedAt: Record<string, string>;
  skipped: string[];
  seeded: boolean;
}

interface QuestState {
  id: string;
  met: boolean;
  completed: boolean;
  completedAt: string | null;
  skipped: boolean;
}

interface QuestProgress {
  quests: QuestState[];
  completed: number;
  total: number;
  nextCompletedAt: Record<string, string>;
  latchChanged: boolean;
  seeding: boolean;
}

type EvaluateQuests = (m: RawMetrics, latch: QuestLatch, nowIso: string) => QuestProgress;

function evaluate(): EvaluateQuests {
  return (require("@/lib/quests/evaluate") as { evaluateQuests: EvaluateQuests }).evaluateQuests;
}

function baseMetrics(): RawMetrics {
  return {
    completedMissions: 0,
    failedMissions: 0,
    completedRuns: 0,
    totalTokens: 0,
    stories: 0,
    schedulesEnabled: 0,
    scriptsEnabled: 0,
    longestStreak: 0,
    currentStreak: 0,
    completionHours: [],
    dispatchedMissions: 0,
    maxMissionsInADay: 0,
    chaptersGenerated: 0,
    storiesCompleted: 0,
    sessionsStarted: 0,
    schedulesCreated: 0,
    schedulesFired: 0,
    skillToggles: 0,
    personalityChanges: 0,
    modelConfigs: 0,
    chatMessages: 0,
    distinctProfiles: 0,
    distinctEventTypes: 0,
    eventCounts: {},
    facts: { profiles: 0, models: 0, credentials: 0, workflows: 0, memoryConfigured: false },
  };
}

function withDispatch(n: number): RawMetrics {
  const m = baseMetrics();
  m.eventCounts["mission.dispatched"] = n;
  m.eventCounts["chat.message_sent"] = n;
  return m;
}

const FIRST = "2026-09-01T09:00:00.000Z";
const LATER = "2026-12-25T09:00:00.000Z";
const FRESH: QuestLatch = { completedAt: {}, skipped: [], seeded: true };

function stateOf(p: QuestProgress, id: string): QuestState {
  const q = p.quests.find((x) => x.id === id);
  if (!q) throw new Error(`no quest ${id}`);
  return q;
}

// ═══════════════════════════════════════════════════════════════
// (A) the pure evaluator holds the high-water mark
// ═══════════════════════════════════════════════════════════════

describe("A. a completed quest never un-completes", () => {
  it("stays complete when retention has taken every event it was derived from", () => {
    // The operator dispatches, and 1.3 and 1.4 tick.
    const before = evaluate()(withDispatch(1), FRESH, FIRST);
    expect(stateOf(before, "1.4").completed).toBe(true);
    expect(before.nextCompletedAt["1.4"]).toBe(FIRST);

    // ADR-0009 prunes analytics_events. The ledger now reads zero.
    const latch: QuestLatch = { completedAt: before.nextCompletedAt, skipped: [], seeded: true };
    const after = evaluate()(baseMetrics(), latch, LATER);

    const q = stateOf(after, "1.4");
    expect(q.met).toBe(false); // the metrics genuinely say nothing
    expect(q.completed).toBe(true); // the latch says otherwise, and wins
    expect(q.completedAt).toBe(FIRST); // when it was FIRST seen, never restamped
    expect(after.completed).toBe(before.completed);
  });

  it("never rewrites a stamp it already holds", () => {
    const latch: QuestLatch = { completedAt: { "1.4": FIRST }, skipped: [], seeded: true };
    const out = evaluate()(withDispatch(3), latch, LATER);
    expect(out.nextCompletedAt["1.4"]).toBe(FIRST);
    expect(stateOf(out, "1.4").completedAt).toBe(FIRST);
  });

  it("only ever grows the map, and carries an id it does not recognise through untouched", () => {
    // A renamed or retired quest must not silently delete an operator's
    // history: the merged map is a superset of what it was handed.
    const latch: QuestLatch = { completedAt: { "1.4": FIRST, "9.9": FIRST }, skipped: [], seeded: true };
    const out = evaluate()(withDispatch(1), latch, LATER);
    expect(out.nextCompletedAt["9.9"]).toBe(FIRST);
    expect(out.nextCompletedAt["1.4"]).toBe(FIRST);
    expect(out.nextCompletedAt["1.3"]).toBe(LATER);
    for (const id of Object.keys(latch.completedAt)) expect(out.nextCompletedAt).toHaveProperty(id);
  });

  it("says whether the caller has anything to persist", () => {
    const nothingNew = evaluate()(baseMetrics(), { completedAt: { "1.4": FIRST }, skipped: [], seeded: true }, LATER);
    expect(nothingNew.latchChanged).toBe(false);
    expect(nothingNew.nextCompletedAt).toEqual({ "1.4": FIRST });

    const somethingNew = evaluate()(withDispatch(1), FRESH, LATER);
    expect(somethingNew.latchChanged).toBe(true);
  });

  it("flags the very first evaluation of an install, so nothing toasts for the past", () => {
    // `seeded` is the presence of the ROW, not a non-empty map: an install
    // whose first read finds nothing must still seed, or the whole backlog
    // toasts on the second poll.
    const first = evaluate()(withDispatch(1), { completedAt: {}, skipped: [], seeded: false }, FIRST);
    expect(first.seeding).toBe(true);
    expect(first.latchChanged).toBe(true); // it still writes: that is what seeds it

    const second = evaluate()(withDispatch(1), { completedAt: first.nextCompletedAt, skipped: [], seeded: true }, LATER);
    expect(second.seeding).toBe(false);
  });

  it("a skipped quest that was already latched keeps its stamp", () => {
    const latch: QuestLatch = { completedAt: { "1.2": FIRST }, skipped: ["1.2"], seeded: true };
    const out = evaluate()(baseMetrics(), latch, LATER);
    const q = stateOf(out, "1.2");
    expect(q.skipped).toBe(true);
    expect(q.completed).toBe(true);
    expect(q.completedAt).toBe(FIRST);
  });
});

// ═══════════════════════════════════════════════════════════════
// (B) the repository, over the real operator_prefs table
// ═══════════════════════════════════════════════════════════════

let testDb: import("better-sqlite3").Database | null = null;

jest.mock("@/lib/db", () => {
  const actualCrypto = jest.requireActual("crypto") as typeof import("crypto");
  return {
    getDb: () => testDb!,
    inTransaction: <T,>(fn: () => T) => testDb!.transaction(fn)(),
    uuid: () => actualCrypto.randomUUID(),
    now: () => new Date().toISOString(),
    ensureDb: () => undefined,
  };
});

import { execBaselineSchema } from "../helpers/baseline-db";
import { applyOperatorPrefsMigration } from "@/lib/db/apply-operator-prefs-migration";
import { readOperatorPrefs, writeOperatorPref } from "@/lib/operator-prefs-repository";

const migrationsDir = join(process.cwd(), "src", "lib", "db", "migrations");

interface LatchModule {
  readQuestLatch: () => QuestLatch;
  writeQuestCompletions: (completedAt: Record<string, string>) => void;
}
function latchModule(): LatchModule {
  return require("@/lib/quests/quest-latch") as LatchModule;
}

function openDb(withPrefs: boolean) {
  const Database = require("better-sqlite3/lib/index.js") as typeof import("better-sqlite3");
  const db = new (Database as unknown as new (path: string) => import("better-sqlite3").Database)(":memory:");
  execBaselineSchema(db);
  if (withPrefs) applyOperatorPrefsMigration(db, migrationsDir);
  return db;
}

afterEach(() => {
  testDb?.close();
  testDb = null;
});

describe("B. the latch lives in operator_prefs, under the key B3 already ships", () => {
  it("reads an unseeded latch on a fresh install", () => {
    testDb = openDb(true);
    expect(latchModule().readQuestLatch()).toEqual({ completedAt: {}, skipped: [], seeded: false });
  });

  it("counts an EMPTY stored map as seeded: the row is the flag, not its contents", () => {
    testDb = openDb(true);
    writeOperatorPref("quests.completedAt", {});
    expect(latchModule().readQuestLatch()).toEqual({ completedAt: {}, skipped: [], seeded: true });
  });

  it("round-trips through the allow-listed key, with no new key and no new migration", () => {
    testDb = openDb(true);
    latchModule().writeQuestCompletions({ "1.4": FIRST, "7.1": LATER });
    expect(readOperatorPrefs()["quests.completedAt"]).toEqual({ "1.4": FIRST, "7.1": LATER });
    expect(latchModule().readQuestLatch()).toEqual({
      completedAt: { "1.4": FIRST, "7.1": LATER },
      skipped: [],
      seeded: true,
    });
  });

  it("reads the skip list from the key beside it", () => {
    testDb = openDb(true);
    writeOperatorPref("quests.skipped", ["1.2"]);
    expect(latchModule().readQuestLatch().skipped).toEqual(["1.2"]);
  });

  it("never throws on a database that has no operator_prefs table", () => {
    // The dashboard must not go dark because bookkeeping is missing.
    testDb = openDb(false);
    expect(() => latchModule().readQuestLatch()).not.toThrow();
    expect(latchModule().readQuestLatch()).toEqual({ completedAt: {}, skipped: [], seeded: false });
  });

  it("never throws on a stored value it cannot read", () => {
    testDb = openDb(true);
    testDb
      .prepare("INSERT INTO operator_prefs (key, value_json, updated_at) VALUES (?, ?, ?)")
      .run("quests.completedAt", "{not json", new Date().toISOString());
    expect(() => latchModule().readQuestLatch()).not.toThrow();
    expect(latchModule().readQuestLatch().completedAt).toEqual({});
  });
});

// ═══════════════════════════════════════════════════════════════
// (C) where the write happens
// ═══════════════════════════════════════════════════════════════

describe("C. the stats read latches beside the progression capture", () => {
  const src = readFileSync(join(process.cwd(), "src", "app", "api", "stats", "route.ts"), "utf-8");

  it("writes the merged map from GET /api/stats", () => {
    expect(src).toMatch(/writeQuestCompletions/);
    expect(src).toMatch(/latchChanged/);
  });

  it("skips the write under read-only, behind the guard that is already there", () => {
    const guard = src.indexOf("isReadOnly()");
    const write = src.indexOf("writeQuestCompletions");
    expect(guard).toBeGreaterThan(-1);
    expect(write).toBeGreaterThan(guard);
    expect(src).toMatch(/check-read-only-guards-disable-next-line/);
  });

  it("keeps its own try, so a progression failure cannot swallow the latch", () => {
    const tries = src.match(/try\s*\{/g) ?? [];
    expect(tries.length).toBeGreaterThanOrEqual(3);
    expect(src).toMatch(/latching quest completions/);
  });

  it("adds no endpoint of its own: quests ride the stats poll", () => {
    const repo = readFileSync(join(process.cwd(), "src", "lib", "stats", "stats-repository.ts"), "utf-8");
    expect(repo).toMatch(/evaluateQuests/);
    // Evaluated after the achievements, on the same raw metrics.
    expect(repo.indexOf("evaluateQuests")).toBeGreaterThan(repo.indexOf("evaluateAchievements(raw)"));
    expect(repo).toMatch(/quests:/);
  });
});
