/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports -- better-sqlite3's package root is not newable under the jest transform; same construction as the-numbers-are-measured.test.ts */

// B4 (T-0098) oracle, the repository half: the stats reader measures a
// per-type ledger over analytics_events and the store facts the quest
// evaluator reads (named profiles, models, credentials, workflows, and whether
// the operator has saved a memory provider rather than inherited the seeded
// guess). computeDashboard() hands both the stats and the raw metrics back so
// B17 can evaluate quests from the same read at zero extra requests.

import { join } from "path";

import { execBaselineSchema } from "../helpers/baseline-db";
import { applyAnalyticsEventsMigration } from "@/lib/db/apply-analytics-events-migration";
import { applyComposerMigration } from "@/lib/db/apply-composer-migration";
import { applyMemoryProvidersMigration } from "@/lib/db/apply-memory-providers-migration";
import { ANALYTICS_EVENT_TYPES, COMPLETIONIST_EVENT_TYPES } from "@/lib/analytics/event-types";

let testDb: import("better-sqlite3").Database | null = null;

jest.mock("@/lib/db", () => ({
  getDb: () => testDb!,
  inTransaction: <T,>(fn: () => T) => testDb!.transaction(fn)(),
  ensureDb: () => undefined,
  uuid: () => `id-${Math.random().toString(36).slice(2)}`,
  now: () => new Date().toISOString(),
}));
jest.mock("@/lib/stats/agent-stats", () => ({ getAgentPerformance: () => [] }));

import { computeDashboard, getDashboardStats } from "@/lib/stats/stats-repository";

const migrationsDir = join(process.cwd(), "src", "lib", "db", "migrations");

function openDb(withNewerTables: boolean) {
  const Database = require("better-sqlite3/lib/index.js") as typeof import("better-sqlite3");
  const db = new (Database as unknown as new (path: string) => import("better-sqlite3").Database)(":memory:");
  execBaselineSchema(db);
  if (withNewerTables) {
    applyAnalyticsEventsMigration(db, migrationsDir);
    applyComposerMigration(db, migrationsDir);
    applyMemoryProvidersMigration(db, migrationsDir);
  }
  return db;
}

let seq = 0;
function event(type: string) {
  testDb!.prepare("INSERT INTO analytics_events (id, event_type) VALUES (?, ?)").run(`e${++seq}`, type);
}

afterEach(() => {
  testDb?.close();
  testDb = null;
});

describe("computeDashboard().raw.eventCounts", () => {
  it("carries every type in the taxonomy, counted, zero when never recorded", () => {
    testDb = openDb(true);
    event("research.started");
    event("research.started");
    event("mission.dispatched");
    const { raw } = computeDashboard();
    expect(raw.eventCounts["research.started"]).toBe(2);
    expect(raw.eventCounts["mission.dispatched"]).toBe(1);
    expect(raw.eventCounts["help.opened"]).toBe(0);
    expect(Object.keys(raw.eventCounts).sort()).toEqual([...ANALYTICS_EVENT_TYPES].sort());
    expect(raw.distinctEventTypes).toBe(2);
  });

  it("feeds Completionist: curated types recorded count, a failure does not", () => {
    testDb = openDb(true);
    const three = COMPLETIONIST_EVENT_TYPES.slice(0, 3);
    for (const t of three) event(t);
    event("mission.failed");
    event("mission.failed");
    const { stats } = computeDashboard();
    const c = stats.achievements.find((a) => a.id === "completionist")!;
    expect(c.current).toBe(3);
    expect(c.target).toBe(COMPLETIONIST_EVENT_TYPES.length);
    expect(getDashboardStats().achievements.find((a) => a.id === "completionist")!.current).toBe(3);
  });
});

describe("computeDashboard().raw.facts", () => {
  it("counts named profiles, models, credentials and workflows from the store", () => {
    testDb = openDb(true);
    // Four different numbers, so a count read from the wrong table shows.
    testDb.prepare("INSERT INTO agent_profiles (slug, display_name) VALUES (?, ?)").run("scout", "Scout");
    testDb.prepare("INSERT INTO agent_profiles (slug, display_name) VALUES (?, ?)").run("writer", "Writer");
    for (const id of ["m1", "m2", "m3"]) {
      testDb.prepare("INSERT INTO models (id, name, provider, model_id) VALUES (?, ?, ?, ?)").run(id, `Model ${id}`, "openai", "gpt-x");
    }
    testDb.prepare("INSERT INTO credentials (id, label, provider, api_key) VALUES (?, ?, ?, ?)").run("c1", "key", "openai", "sk-test");
    for (const id of ["w1", "w2", "w3", "w4"]) {
      testDb.prepare("INSERT INTO composer_workflows (id, name) VALUES (?, ?)").run(id, `Workflow ${id}`);
    }
    const { raw } = computeDashboard();
    expect(raw.facts).toEqual({ profiles: 2, models: 3, credentials: 1, workflows: 4, memoryConfigured: false });
  });

  it("says memory is configured only once the operator saved the provider, active and enabled", () => {
    testDb = openDb(true);
    // The migration seeds an active Hindsight row as a guess; a guess is not a configuration.
    expect(computeDashboard().raw.facts.memoryConfigured).toBe(false);
    testDb.prepare("UPDATE memory_providers SET updated_at = datetime('now', '+1 minute') WHERE type = 'hindsight'").run();
    expect(computeDashboard().raw.facts.memoryConfigured).toBe(true);
    testDb.prepare("UPDATE memory_providers SET enabled = 0 WHERE type = 'hindsight'").run();
    expect(computeDashboard().raw.facts.memoryConfigured).toBe(false);
    testDb.prepare("UPDATE memory_providers SET enabled = 1, is_active = 0 WHERE type = 'hindsight'").run();
    expect(computeDashboard().raw.facts.memoryConfigured).toBe(false);
  });

  it("reads zeros, not errors, on a database without the newer tables", () => {
    testDb = openDb(false);
    const { raw, stats } = computeDashboard();
    for (const t of ANALYTICS_EVENT_TYPES) expect(raw.eventCounts[t]).toBe(0);
    expect(raw.facts).toEqual({ profiles: 0, models: 0, credentials: 0, workflows: 0, memoryConfigured: false });
    expect(stats.achievements.find((a) => a.id === "completionist")!.current).toBe(0);
  });
});
