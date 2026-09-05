/** @jest-environment node */
// ORACLE for T-0021 (WO-0014): the SQL, against REAL SQLite.
//
// Two things here are not obvious from reading the queries, and both are the
// kind of bug that shows a plausible number rather than an error.
//
// 1. TIMESTAMPS IN `runs` ARE NOT ALL THE SAME SHAPE. `submitted_at` gets the
//    column DEFAULT `datetime('now')` when the scheduler claims an occurrence
//    ("2026-08-23 10:00:00") and `now()` = `new Date().toISOString()` when the
//    repository writes it ("2026-08-23T10:00:00.000Z"). Those two do not compare
//    correctly as strings, so every comparison goes through SQLite's
//    `datetime()`. Same trap, same answer as retention-repository.ts.
//
// 2. A COMPOSER STAGE RUN HAS NO MISSION. The Insights per-model aggregate
//    INNER JOINs missions, so Composer spend has never appeared in it at all.
//    This read LEFT JOINs, which is the whole reason Composer stages show up as
//    a source rather than as a rounding error.

import { join } from "path";
import type DatabaseNs from "better-sqlite3";
import { execBaselineSchema } from "../helpers/baseline-db";
import { applyComposerMigration } from "@/lib/db/apply-composer-migration";
import { applyDeepResearchMigration } from "@/lib/db/apply-deep-research-migration";
import { applySpendPolicyMigration } from "@/lib/db/apply-spend-policy-migration";
import { applyResearchUsageMigration } from "@/lib/db/apply-research-usage-migration";

type RealDb = DatabaseNs.Database;

let testDb: RealDb | null = null;

jest.mock("@/lib/db", () => ({
  getDb: () => testDb!,
  inTransaction: <T,>(fn: () => T) => testDb!.transaction(fn)(),
  ensureDb: () => undefined,
}));

const Database = jest.requireActual(
  join(process.cwd(), "node_modules", "better-sqlite3", "lib", "index.js"),
) as unknown as new (path: string) => RealDb;

const migrationsDir = join(process.cwd(), "src", "lib", "db", "migrations");

import {
  readResearchUsageSince,
  readRunUsageSince,
  readSpendPolicy,
  writeSpendPolicy,
} from "@/lib/spend/spend-repository";

const USAGE = JSON.stringify({ inputTokens: 100, outputTokens: 50, totalTokens: 150 });

function insertRun(
  id: string,
  submittedAt: string,
  opts: { missionId?: string; composerNodeRunId?: string; usage?: string | null } = {},
): void {
  testDb!
    .prepare(
      `INSERT INTO runs (id, mission_id, composer_node_run_id, status, usage_json, submitted_at, updated_at)
       VALUES (?, ?, ?, 'completed', ?, ?, ?)`,
    )
    .run(
      id,
      opts.missionId ?? null,
      opts.composerNodeRunId ?? null,
      opts.usage === undefined ? USAGE : opts.usage,
      submittedAt,
      submittedAt,
    );
}

beforeEach(() => {
  testDb = new Database(":memory:");
  execBaselineSchema(testDb);
  // In ladder order. Each applier gates on the stored version, so running
  // Composer (v21) before Deep Research (v19) would make the second one a
  // silent no-op and leave research_runs missing.
  applyDeepResearchMigration(testDb, migrationsDir);
  applyComposerMigration(testDb, migrationsDir);
  applySpendPolicyMigration(testDb, migrationsDir);
  applyResearchUsageMigration(testDb, migrationsDir);
  testDb
    .prepare("INSERT INTO missions (id, name, prompt, model_id) VALUES ('m1','M','p','claude-sonnet-4')")
    .run();
});

afterEach(() => {
  testDb?.close();
  testDb = null;
});

describe("readRunUsageSince", () => {
  it("labels a mission run 'agent' and carries the mission's model", () => {
    insertRun("r1", "2026-08-20 10:00:00", { missionId: "m1" });
    const rows = readRunUsageSince("2026-08-01 00:00:00");
    expect(rows).toEqual([{ source: "agent", model: "claude-sonnet-4", usage: USAGE }]);
  });

  it("labels a Composer stage run 'composer' even though it has no mission", () => {
    insertRun("r2", "2026-08-20 10:00:00", { composerNodeRunId: "nr1" });
    const rows = readRunUsageSince("2026-08-01 00:00:00");
    expect(rows).toEqual([{ source: "composer", model: null, usage: USAGE }]);
  });

  it("labels a Composer stage run 'composer' even when it is linked to a mission", () => {
    insertRun("r3", "2026-08-20 10:00:00", { missionId: "m1", composerNodeRunId: "nr1" });
    expect(readRunUsageSince("2026-08-01 00:00:00")[0].source).toBe("composer");
  });

  it("skips runs that recorded no usage at all", () => {
    insertRun("r4", "2026-08-20 10:00:00", { missionId: "m1", usage: null });
    expect(readRunUsageSince("2026-08-01 00:00:00")).toEqual([]);
  });

  it("excludes runs submitted before the window", () => {
    insertRun("old", "2026-07-31 23:59:59", { missionId: "m1" });
    insertRun("new", "2026-08-01 00:00:01", { missionId: "m1" });
    expect(readRunUsageSince("2026-08-01 00:00:00")).toHaveLength(1);
  });

  // The trap. Both shapes exist in a real `runs` table, and a naive string
  // comparison silently drops every ISO-8601 row from the window.
  it("compares both timestamp shapes correctly", () => {
    insertRun("sqlite-shape", "2026-08-20 10:00:00", { missionId: "m1" });
    insertRun("iso-shape", "2026-08-20T10:00:00.000Z", { missionId: "m1" });
    expect(readRunUsageSince("2026-08-01 00:00:00")).toHaveLength(2);
    expect(readRunUsageSince("2026-08-21 00:00:00")).toHaveLength(0);
  });

  it("counts every run in the window, not just the completed ones", () => {
    // A run that failed after burning tokens still cost money.
    testDb!
      .prepare(
        `INSERT INTO runs (id, mission_id, status, usage_json, submitted_at, updated_at)
         VALUES ('rf','m1','failed',?, '2026-08-20 10:00:00','2026-08-20 10:00:00')`,
      )
      .run(USAGE);
    expect(readRunUsageSince("2026-08-01 00:00:00")).toHaveLength(1);
  });
});

describe("readResearchUsageSince", () => {
  const insert = (id: string, at: string, prompt: number | null, completion: number | null) =>
    testDb!
      .prepare(
        `INSERT INTO research_runs (id, query, created_at, prompt_tokens, completion_tokens, total_tokens)
         VALUES (?, 'q', ?, ?, ?, ?)`,
      )
      .run(id, at, prompt, completion, prompt === null ? null : prompt + (completion ?? 0));

  it("returns the recorded counts for runs inside the window", () => {
    insert("rr1", "2026-08-20 10:00:00", 100, 50);
    const rows = readResearchUsageSince("2026-08-01 00:00:00");
    expect(rows).toEqual([{ promptTokens: 100, completionTokens: 50, model: null }]);
  });

  it("excludes runs outside the window", () => {
    insert("rr1", "2026-08-20 10:00:00", 100, 50);
    insert("rr2", "2026-07-01 10:00:00", 999, 999);
    expect(readResearchUsageSince("2026-08-01 00:00:00")).toHaveLength(1);
  });

  // The load-bearing one. A run whose usage was never recorded MUST come back,
  // with nulls intact, so the summary can price the counted runs and still
  // declare this one. Filtering it out here would silently resume reporting
  // pre-034 research as free, which is the whole defect T-0030 removed.
  it("returns pre-034 runs with their nulls, rather than dropping them", () => {
    insert("rr1", "2026-08-20 10:00:00", null, null);
    insert("rr2", "2026-08-21 10:00:00", 10, 5);
    const rows = readResearchUsageSince("2026-08-01 00:00:00");
    expect(rows).toHaveLength(2);
    expect(rows.filter((r) => r.promptTokens === null)).toHaveLength(1);
  });

  it("distinguishes a recorded zero from an absent count", () => {
    insert("rr1", "2026-08-20 10:00:00", 0, 0);
    const rows = readResearchUsageSince("2026-08-01 00:00:00");
    expect(rows[0].promptTokens).toBe(0);
    expect(rows[0].promptTokens).not.toBeNull();
  });

  it("is empty on an install that has never run one", () => {
    expect(readResearchUsageSince("2026-08-01 00:00:00")).toEqual([]);
  });
});

describe("readSpendPolicy / writeSpendPolicy", () => {
  it("reads the seeded unset policy", () => {
    const p = readSpendPolicy();
    expect(p.limitUsd).toBeNull();
    expect(p.hardStop).toBe(false);
    expect(p.period).toBe("month");
  });

  it("writes a figure and reads it back", () => {
    writeSpendPolicy({ limitUsd: 40, period: "week" });
    const p = readSpendPolicy();
    expect(p.limitUsd).toBe(40);
    expect(p.period).toBe("week");
    expect(p.hardStop).toBe(false);
  });

  it("arms and disarms the stop", () => {
    writeSpendPolicy({ limitUsd: 40 });
    writeSpendPolicy({ hardStop: true });
    expect(readSpendPolicy().hardStop).toBe(true);
    writeSpendPolicy({ hardStop: false });
    expect(readSpendPolicy().hardStop).toBe(false);
  });

  it("clears the figure back to unset", () => {
    writeSpendPolicy({ limitUsd: 40 });
    writeSpendPolicy({ limitUsd: null, hardStop: false });
    expect(readSpendPolicy().limitUsd).toBeNull();
  });

  it("writing nothing is a no-op rather than an error", () => {
    writeSpendPolicy({ limitUsd: 40 });
    expect(() => writeSpendPolicy({})).not.toThrow();
    expect(readSpendPolicy().limitUsd).toBe(40);
  });

  it("stamps updated_at so the console can say when the figure was last changed", () => {
    const before = readSpendPolicy().updatedAt;
    testDb!.prepare("UPDATE spend_policy SET updated_at = '2000-01-01 00:00:00'").run();
    writeSpendPolicy({ limitUsd: 40 });
    expect(readSpendPolicy().updatedAt).not.toBe("2000-01-01 00:00:00");
    expect(before).toBeTruthy();
  });
});
