/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports */
// THE IMMUTABILITY PROOF for the per-Body progression record (WG-ARCH-003).
//
// The acceptance is that one row per agent profile is immutable, and that a
// correction lands as a NEW ROW with no UPDATE and no DELETE in the write path.
// A comment cannot hold that and a code review cannot keep holding it, so this
// runs the real write path against real SQLite with migration 031's triggers
// armed and asserts the database itself refuses.
//
// The third test is the important one. It does not inspect the repository's
// source for the word UPDATE; it drives `captureAgentProgressionSnapshots`
// through a genuine correction. If the write path ever tried to edit a row
// instead of appending one, the trigger would abort the transaction and this
// test would fail with the trigger's own message. That is a proof about the
// code that runs, not about the code as it currently reads.

import { join } from "path";
import { execBaselineSchema } from "../helpers/baseline-db";
import { applyAgentProgressionMigration } from "@/lib/db/apply-agent-progression-migration";

let testDb: import("better-sqlite3").Database | null = null;

jest.mock("@/lib/db", () => ({
  getDb: () => testDb!,
  inTransaction: <T,>(fn: () => T) => testDb!.transaction(fn)(),
  ensureDb: () => undefined,
  uuid: () => "test-uuid",
  now: () => new Date().toISOString(),
}));

import {
  captureAgentProgressionSnapshots,
  AGENT_PROGRESSION_COMPUTATION_VERSION,
} from "@/lib/stats/agent-progression";
import { readAgentProgressionHistory } from "@/lib/stats/agent-progression-repository";
import type { AgentPerformance } from "@/lib/stats/agent-stats";
import type { Achievement } from "@/lib/stats/derive";

const migrationsDir = join(process.cwd(), "src", "lib", "db", "migrations");

function agent(over: Partial<AgentPerformance> = {}): AgentPerformance {
  return {
    slug: "scout",
    name: "Scout",
    runs: 1,
    runsCompleted: 1,
    missionsCompleted: 1,
    missionsFailed: 0,
    totalTokens: 1_000,
    avgDurationSec: 4,
    skills: 2,
    toolsets: 1,
    ...over,
  };
}

function achievement(id: string, unlocked: boolean): Achievement {
  return {
    id,
    name: id,
    description: id,
    icon: "Rocket",
    color: "cyan",
    unlocked,
    progress: unlocked ? 1 : 0,
    current: unlocked ? 1 : 0,
    target: 1,
    tier: "common",
    points: 10,
  };
}

const ACHIEVEMENTS = [achievement("first-contact", true), achievement("veteran", false)];

function seedOneRow(): void {
  testDb!
    .prepare(
      `INSERT INTO agent_progression_snapshots
         (profile_slug, level, level_title, xp, achievements_scope, achievements_json,
          inputs_json, inputs_digest, schema_version, computation_version)
       VALUES ('scout', 4, 'Specialist', 700, 'install', '[]', '{}', 'deadbeef', 31, 1)`,
    )
    .run();
}

beforeEach(() => {
  const Database = require("better-sqlite3/lib/index.js") as typeof import("better-sqlite3");
  testDb = new (Database as unknown as new (path: string) => import("better-sqlite3").Database)(
    ":memory:",
  );
  testDb.pragma("foreign_keys = ON");
  execBaselineSchema(testDb);
  applyAgentProgressionMigration(testDb, migrationsDir);
});
afterEach(() => {
  testDb?.close();
  testDb = null;
});

describe("agent_progression_snapshots is append-only", () => {
  it("refuses an UPDATE, and the row is unchanged afterwards", () => {
    seedOneRow();
    const before = testDb!.prepare("SELECT * FROM agent_progression_snapshots").get();

    expect(() =>
      testDb!.prepare("UPDATE agent_progression_snapshots SET level = 99 WHERE id = 1").run(),
    ).toThrow(/append-only/);

    expect(testDb!.prepare("SELECT * FROM agent_progression_snapshots").get()).toEqual(before);
  });

  it("refuses a DELETE, and the row is still there afterwards", () => {
    seedOneRow();

    expect(() =>
      testDb!.prepare("DELETE FROM agent_progression_snapshots WHERE id = 1").run(),
    ).toThrow(/append-only/);
    expect(() => testDb!.prepare("DELETE FROM agent_progression_snapshots").run()).toThrow(
      /append-only/,
    );

    expect(
      (
        testDb!.prepare("SELECT COUNT(*) c FROM agent_progression_snapshots").get() as {
          c: number;
        }
      ).c,
    ).toBe(1);
  });

  it("a correction through the real write path appends a row and leaves the first untouched", () => {
    expect(captureAgentProgressionSnapshots({ agents: [agent()], achievements: ACHIEVEMENTS })).toBe(
      1,
    );
    const first = readAgentProgressionHistory("scout")[0];

    // The agent grows: more runs, more tokens, an achievement unlocks. Every one
    // of those is a reason to correct the record, and the only legal correction
    // is another row.
    const written = captureAgentProgressionSnapshots({
      agents: [agent({ runs: 12, totalTokens: 40_000 })],
      achievements: [achievement("first-contact", true), achievement("veteran", true)],
    });

    expect(written).toBe(1);
    const history = readAgentProgressionHistory("scout");
    expect(history).toHaveLength(2);
    expect(history[0]).toEqual(first); // byte-identical: nothing edited the original
    expect(history[1].id).toBeGreaterThan(first.id);
    expect(history[1].xp).toBeGreaterThan(first.xp);
    expect(history[1].capturedAt).toBeTruthy();
  });

  it("an unchanged answer appends nothing, so the steady state is one row per profile", () => {
    expect(captureAgentProgressionSnapshots({ agents: [agent()], achievements: ACHIEVEMENTS })).toBe(
      1,
    );
    expect(captureAgentProgressionSnapshots({ agents: [agent()], achievements: ACHIEVEMENTS })).toBe(
      0,
    );
    expect(captureAgentProgressionSnapshots({ agents: [agent()], achievements: ACHIEVEMENTS })).toBe(
      0,
    );

    expect(readAgentProgressionHistory("scout")).toHaveLength(1);
  });

  it("force appends even when the answer has not moved, without editing anything", () => {
    // The retention prune's interlock (ADR-0009) reads the newest capture's
    // timestamp to decide what it may delete, so it needs a row written NOW even
    // on an install whose answer has been still for months. Forcing must still
    // APPEND: if it were ever implemented as an in-place refresh of the existing
    // row, migration 031's trigger would abort and this would fail.
    expect(captureAgentProgressionSnapshots({ agents: [agent()], achievements: ACHIEVEMENTS })).toBe(
      1,
    );
    const first = readAgentProgressionHistory("scout")[0];

    expect(
      captureAgentProgressionSnapshots(
        { agents: [agent()], achievements: ACHIEVEMENTS },
        { force: true },
      ),
    ).toBe(1);

    const history = readAgentProgressionHistory("scout");
    expect(history).toHaveLength(2);
    expect(history[0]).toEqual(first);
    expect(history[1].xp).toBe(first.xp); // same answer, recorded again
    expect(history[1].id).toBeGreaterThan(first.id);
  });

  it("records the schema and computation versions the row was written under", () => {
    captureAgentProgressionSnapshots({ agents: [agent()], achievements: ACHIEVEMENTS });

    const row = readAgentProgressionHistory("scout")[0];
    expect(row.schemaVersion).toBe(31);
    // The CONSTANT, not the literal 1. The claim in this test's name is that a
    // row records the version in force when it was written -- so a deliberate
    // bump (T-0081 raised it to 2 when runsCompleted began counting
    // completions) is the formula version doing its job, not a regression, and
    // should not need an assertion edited to stay true.
    expect(row.computationVersion).toBe(AGENT_PROGRESSION_COMPUTATION_VERSION);
    expect(row.achievementsScope).toBe("install");
  });
});
