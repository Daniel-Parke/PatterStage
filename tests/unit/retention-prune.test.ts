/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports */
// THE PROOF FOR THE RETENTION PRUNE (T-0017, WO-0009, ADR-0009).
//
// This is the only code path in PatterStage that deletes a user's rows, it runs
// on machines nobody here can inspect, and it cannot be undone. So it is proved
// against real SQLite with the real migrations applied, not against a mock.
//
// Four claims are made and each one has its own describe block:
//
//   THE BOUNDARY   the delete takes exactly the rows the window says and not one
//                  more. Proved with rows planted one second either side of an
//                  exact cutoff, so an off-by-one in the comparison is red rather
//                  than invisible.
//
//   THE INTERLOCK  nothing is deleted that the per-Body progression record has
//                  not already captured. Proved by driving the prune with no
//                  capture, with a stale capture and with a failing capture, and
//                  asserting every row survives all three.
//
//   THE POSTURE    disabled by default, dry run by default. Proved by running
//                  the prune against a freshly migrated database, which is
//                  exactly the state an existing install is in the moment after
//                  it takes this upgrade.
//
//   THE RECORD     an applied run leaves evidence of what it took, including
//                  when it took nothing.

import { join } from "path";

let testDb: import("better-sqlite3").Database | null = null;

jest.mock("@/lib/db", () => ({
  getDb: () => testDb!,
  inTransaction: <T,>(fn: () => T) => testDb!.transaction(fn)(),
  ensureDb: () => undefined,
  uuid: () => "test-uuid",
  now: () => new Date().toISOString(),
}));

import { execBaselineSchema } from "../helpers/baseline-db";
import { applyAnalyticsEventsMigration } from "@/lib/db/apply-analytics-events-migration";
import { applyChatMigration } from "@/lib/db/apply-chat-migration";
import { applyAgentProgressionMigration } from "@/lib/db/apply-agent-progression-migration";
import { applyRetentionMigration } from "@/lib/db/apply-retention-migration";
import { runRetentionPrune } from "@/lib/retention/retention-prune";
import {
  countAnalyticsEventsBefore,
  countExpiredChatConversations,
  countExpiredChatMessages,
  deleteAnalyticsEventsBefore,
  deleteExpiredChatConversations,
  readRetentionPolicies,
  readRetentionPruneRuns,
  setRetentionPolicy,
} from "@/lib/retention/retention-repository";
import { readRetentionStatus } from "@/lib/retention/retention-status";

const migrationsDir = join(process.cwd(), "src", "lib", "db", "migrations");

/** A fixed instant, so the boundary tests do not race the wall clock. */
const CUTOFF = "2026-01-01 00:00:00";
const ONE_SECOND_BEFORE = "2025-12-31 23:59:59";
const ONE_SECOND_AFTER = "2026-01-01 00:00:01";

let eventSeq = 0;
function event(createdAt: string, type = "mission.completed"): string {
  const id = `e${++eventSeq}`;
  testDb!
    .prepare(
      "INSERT INTO analytics_events (id, event_type, created_at) VALUES (?, ?, ?)",
    )
    .run(id, type, createdAt);
  return id;
}

let convoSeq = 0;
/** A conversation plus its messages. `updatedAt` only matters when there are none. */
function conversation(updatedAt: string, messageTimes: string[]): string {
  const id = `c${++convoSeq}`;
  testDb!
    .prepare(
      "INSERT INTO chat_conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
    )
    .run(id, `convo ${id}`, updatedAt, updatedAt);
  messageTimes.forEach((t, i) => {
    testDb!
      .prepare(
        `INSERT INTO chat_messages (id, conversation_id, role, content, created_at, updated_at)
         VALUES (?, ?, 'user', 'hello', ?, ?)`,
      )
      .run(`${id}-m${i}`, id, t, t);
  });
  return id;
}

/** Stand in for the forced capture the command line performs. */
function captureNow(): number {
  testDb!
    .prepare(
      `INSERT INTO agent_progression_snapshots
         (profile_slug, level, level_title, xp, achievements_scope, achievements_json,
          inputs_json, inputs_digest, schema_version, computation_version)
       VALUES ('scout', 4, 'Specialist', 700, 'install', '[]', '{}', 'deadbeef', 32, 1)`,
    )
    .run();
  return 1;
}

/** A capture that happened long ago and has not been repeated since. */
function captureLongAgo(): void {
  testDb!
    .prepare(
      `INSERT INTO agent_progression_snapshots
         (profile_slug, captured_at, level, level_title, xp, achievements_scope,
          achievements_json, inputs_json, inputs_digest, schema_version, computation_version)
       VALUES ('scout', datetime('now','-900 days'), 2, 'Apprentice', 100, 'install',
               '[]', '{}', 'deadbeef', 32, 1)`,
    )
    .run();
}

function analyticsIds(): string[] {
  return (testDb!.prepare("SELECT id FROM analytics_events ORDER BY id").all() as { id: string }[]).map(
    (r) => r.id,
  );
}
function messageIds(): string[] {
  return (testDb!.prepare("SELECT id FROM chat_messages ORDER BY id").all() as { id: string }[]).map(
    (r) => r.id,
  );
}
function conversationIds(): string[] {
  return (
    testDb!.prepare("SELECT id FROM chat_conversations ORDER BY id").all() as { id: string }[]
  ).map((r) => r.id);
}

beforeEach(() => {
  eventSeq = 0;
  convoSeq = 0;
  const Database = require("better-sqlite3/lib/index.js") as typeof import("better-sqlite3");
  testDb = new (Database as unknown as new (path: string) => import("better-sqlite3").Database)(
    ":memory:",
  );
  testDb.pragma("foreign_keys = ON");
  execBaselineSchema(testDb);
  applyAnalyticsEventsMigration(testDb, migrationsDir);
  applyChatMigration(testDb, migrationsDir);
  applyAgentProgressionMigration(testDb, migrationsDir);
  applyRetentionMigration(testDb, migrationsDir);
});
afterEach(() => {
  testDb?.close();
  testDb = null;
});

describe("the boundary: only what the window says", () => {
  it("analytics_events deletes strictly older than the cutoff, keeping the row ON it", () => {
    const older = event(ONE_SECOND_BEFORE);
    const onBoundary = event(CUTOFF);
    const newer = event(ONE_SECOND_AFTER);

    expect(countAnalyticsEventsBefore(CUTOFF)).toBe(1);
    expect(deleteAnalyticsEventsBefore(CUTOFF)).toBe(1);

    expect(analyticsIds()).toEqual([onBoundary, newer].sort());
    expect(analyticsIds()).not.toContain(older);
  });

  it("keeps a row whose timestamp is an ISO-8601 string, not just SQLite's format", () => {
    // chat_messages.created_at is written by JavaScript as ISO-8601 while
    // analytics_events uses SQLite's own format. Compared as raw strings those
    // two disagree within a day, which is why every comparison goes through
    // datetime(). If that normalisation is ever removed, this goes red.
    conversation("2025-06-01T00:00:00.000Z", ["2026-01-01T00:00:01.000Z"]);
    conversation("2025-06-01T00:00:00.000Z", ["2025-12-31T23:59:59.000Z"]);

    expect(countExpiredChatConversations(CUTOFF)).toBe(1);
    expect(countExpiredChatMessages(CUTOFF)).toBe(1);

    deleteExpiredChatConversations(CUTOFF);
    expect(conversationIds()).toEqual(["c1"]);
    expect(messageIds()).toEqual(["c1-m0"]);
  });

  it("keeps a whole conversation when ANY message is inside the window", () => {
    // The unit is the conversation, so one recent turn saves the old ones with
    // it. A transcript that begins in the middle is worse than either honest
    // outcome, which is the reason for the granularity.
    conversation(ONE_SECOND_BEFORE, ["2020-01-01 00:00:00", ONE_SECOND_AFTER]);

    expect(countExpiredChatConversations(CUTOFF)).toBe(0);
    expect(deleteExpiredChatConversations(CUTOFF)).toEqual({ conversations: 0, messages: 0 });
    expect(messageIds()).toHaveLength(2);
  });

  it("takes a conversation whose newest message is one second past the cutoff, with all of it", () => {
    conversation("2020-01-01 00:00:00", ["2019-01-01 00:00:00", ONE_SECOND_BEFORE]);
    const kept = conversation("2020-01-01 00:00:00", [CUTOFF]);

    expect(deleteExpiredChatConversations(CUTOFF)).toEqual({ conversations: 1, messages: 2 });
    expect(conversationIds()).toEqual([kept]);
    expect(messageIds()).toEqual([`${kept}-m0`]);
  });

  it("reaches an abandoned empty conversation through its own updated_at", () => {
    const abandoned = conversation(ONE_SECOND_BEFORE, []);
    const recent = conversation(ONE_SECOND_AFTER, []);

    expect(deleteExpiredChatConversations(CUTOFF)).toEqual({ conversations: 1, messages: 0 });
    expect(conversationIds()).toEqual([recent]);
    expect(conversationIds()).not.toContain(abandoned);
  });

  it("keeps a row whose timestamp cannot be parsed, because NULL is not older", () => {
    event("not a timestamp at all");
    event(ONE_SECOND_BEFORE);

    expect(deleteAnalyticsEventsBefore(CUTOFF)).toBe(1);
    expect(analyticsIds()).toEqual(["e1"]);
  });
});

describe("the interlock: nothing goes that progression has not captured", () => {
  function enableBoth(): void {
    setRetentionPolicy("analytics_events", { enabled: true });
    setRetentionPolicy("chat_messages", { enabled: true });
  }

  function plantExpired(): void {
    event("2020-01-01 00:00:00");
    conversation("2020-01-01 00:00:00", ["2020-01-01 00:00:00"]);
  }

  it("refuses every table when nothing has ever been captured", () => {
    enableBoth();
    plantExpired();

    const report = runRetentionPrune({
      apply: true,
      captureProgression: () => 0,
      log: () => undefined,
    });

    expect(report.tables.map((t) => t.outcome)).toEqual(["refused", "refused"]);
    expect(report.tables.every((t) => t.rowsDeleted === 0)).toBe(true);
    expect(report.tables[0].detail).toMatch(/no progression has ever been captured/);
    expect(analyticsIds()).toHaveLength(1);
    expect(messageIds()).toHaveLength(1);
  });

  it("refuses when the newest capture is older than the cutoff", () => {
    enableBoth();
    plantExpired();
    captureLongAgo();

    const report = runRetentionPrune({
      apply: true,
      // A capture that writes nothing: exactly what the lazy path does on an
      // install whose answer has not moved, which is why the command line forces.
      captureProgression: () => 0,
      log: () => undefined,
    });

    expect(report.tables.map((t) => t.outcome)).toEqual(["refused", "refused"]);
    expect(report.tables[0].detail).toMatch(/older than the cutoff/);
    expect(analyticsIds()).toHaveLength(1);
    expect(messageIds()).toHaveLength(1);
  });

  it("refuses when the capture itself threw, and says so", () => {
    enableBoth();
    plantExpired();
    captureNow(); // a fresh watermark exists, and it is still not enough

    const report = runRetentionPrune({
      apply: true,
      captureProgression: () => {
        throw new Error("disk is full");
      },
      log: () => undefined,
    });

    expect(report.tables.map((t) => t.outcome)).toEqual(["refused", "refused"]);
    expect(report.tables[0].detail).toMatch(/disk is full/);
    expect(analyticsIds()).toHaveLength(1);
  });

  it("proceeds once a capture has just happened, and records what it verified", () => {
    enableBoth();
    plantExpired();
    event("2026-08-01 00:00:00"); // inside every window, must survive

    const report = runRetentionPrune({
      apply: true,
      captureProgression: captureNow,
      log: () => undefined,
    });

    expect(report.tables.map((t) => t.outcome)).toEqual(["pruned", "pruned"]);
    expect(report.progressionWatermark).not.toBeNull();
    for (const table of report.tables) {
      // The evidence for the ordering claim, carried on the report and into the
      // record: the capture is at or after the boundary it deleted behind.
      expect(table.progressionWatermark! >= table.cutoff).toBe(true);
    }
    expect(analyticsIds()).toEqual(["e2"]);
    expect(messageIds()).toHaveLength(0);
    expect(conversationIds()).toHaveLength(0);
  });
});

describe("the posture: an existing install loses nothing by upgrading", () => {
  it("deletes nothing on a freshly migrated database, even with --apply", () => {
    // This is the state an install is in the moment after it takes the upgrade:
    // migration 032 has run, both policies are seeded off, and there is five
    // weeks (or five years) of history sitting there.
    event("2019-01-01 00:00:00");
    conversation("2019-01-01 00:00:00", ["2019-01-01 00:00:00"]);

    const report = runRetentionPrune({
      apply: true,
      captureProgression: captureNow,
      log: () => undefined,
    });

    expect(report.tables.map((t) => t.outcome)).toEqual(["disabled", "disabled"]);
    expect(analyticsIds()).toHaveLength(1);
    expect(messageIds()).toHaveLength(1);
    // It still reports what the window WOULD take, so an operator can see the
    // consequence before arming anything.
    expect(report.tables[0].rowsMatched).toBe(1);
  });

  it("previews without deleting when apply is omitted", () => {
    setRetentionPolicy("analytics_events", { enabled: true });
    event("2019-01-01 00:00:00");

    const report = runRetentionPrune({ captureProgression: captureNow, log: () => undefined });

    expect(report.applied).toBe(false);
    expect(report.tables[0].outcome).toBe("dry-run");
    expect(report.tables[0].rowsMatched).toBe(1);
    expect(report.tables[0].rowsDeleted).toBe(0);
    expect(analyticsIds()).toHaveLength(1);
    // A preview is not an event in this database's history.
    expect(readRetentionPruneRuns()).toHaveLength(0);
  });

  it("a dry run still shows a refusal, so the interlock is discovered before --apply", () => {
    setRetentionPolicy("analytics_events", { enabled: true });
    event("2019-01-01 00:00:00");

    const report = runRetentionPrune({ captureProgression: () => 0, log: () => undefined });

    expect(report.tables[0].outcome).toBe("refused");
  });

  it("honours a widened window: rows inside it survive an applied prune", () => {
    setRetentionPolicy("analytics_events", { enabled: true, retainDays: 4000 });
    event("2019-01-01 00:00:00");

    runRetentionPrune({ apply: true, captureProgression: captureNow, log: () => undefined });

    expect(analyticsIds()).toHaveLength(1);
  });
});

describe("the record: an applied run leaves evidence", () => {
  it("writes one row per table, carrying the cutoff and the watermark it trusted", () => {
    setRetentionPolicy("analytics_events", { enabled: true });
    event("2019-01-01 00:00:00");
    event("2019-01-02 00:00:00");

    runRetentionPrune({ apply: true, captureProgression: captureNow, log: () => undefined });

    const runs = readRetentionPruneRuns();
    expect(runs).toHaveLength(2);
    const analytics = runs.find((r) => r.table === "analytics_events")!;
    expect(analytics.outcome).toBe("pruned");
    expect(analytics.rowsMatched).toBe(2);
    expect(analytics.rowsDeleted).toBe(2);
    expect(analytics.retainDays).toBe(400);
    expect(analytics.cutoff).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    expect(analytics.progressionWatermark).not.toBeNull();
    // The table that was left switched off is recorded too: "it ran and declined"
    // is what an operator needs when the disk is still full.
    expect(runs.find((r) => r.table === "chat_messages")!.outcome).toBe("disabled");
  });

  it("records a refusal, so a prune that never runs is visible rather than silent", () => {
    setRetentionPolicy("analytics_events", { enabled: true });
    event("2019-01-01 00:00:00");

    runRetentionPrune({ apply: true, captureProgression: () => 0, log: () => undefined });

    expect(readRetentionPruneRuns()[0].outcome).toBe("disabled");
    expect(readRetentionPruneRuns().find((r) => r.table === "analytics_events")!.outcome).toBe(
      "refused",
    );
  });

  it("logs what it did, in lines naming the table, the count and the window", () => {
    setRetentionPolicy("analytics_events", { enabled: true });
    event("2019-01-01 00:00:00");
    const lines: string[] = [];

    runRetentionPrune({
      apply: true,
      captureProgression: captureNow,
      log: (line) => lines.push(line),
    });

    expect(lines.some((l) => /progression captured: 1 row/.test(l))).toBe(true);
    expect(lines.some((l) => /analytics_events: deleted 1 row/.test(l))).toBe(true);
    expect(lines.some((l) => /window 400d/.test(l))).toBe(true);
    expect(lines.some((l) => /chat_messages: policy is OFF/.test(l))).toBe(true);
  });
});

describe("the failure modes that must not become half-deletions", () => {
  it("rolls the whole chat prune back rather than orphan a transcript", () => {
    // ON DELETE CASCADE only fires while PRAGMA foreign_keys is ON. If it is off,
    // deleting a conversation would strand its messages, which is a corrupted
    // transcript rather than a partial success. The delete counts orphans and
    // throws, and the transaction takes the conversation row back with it.
    conversation("2020-01-01 00:00:00", ["2020-01-01 00:00:00", "2020-01-02 00:00:00"]);
    testDb!.pragma("foreign_keys = OFF");

    expect(() => deleteExpiredChatConversations(CUTOFF)).toThrow(/CASCADE did not fire/);

    expect(conversationIds()).toHaveLength(1);
    expect(messageIds()).toHaveLength(2);
  });

  it("rolls the delete back when its record cannot be written", () => {
    // A delete that succeeded while its record failed would be the exact hole
    // the record exists to close, so the two commit together. Removing the
    // record table is the cheapest way to make the second half fail for real.
    setRetentionPolicy("analytics_events", { enabled: true });
    event("2019-01-01 00:00:00");
    testDb!.prepare("DROP TABLE retention_prune_runs").run();

    expect(() =>
      runRetentionPrune({ apply: true, captureProgression: captureNow, log: () => undefined }),
    ).toThrow(/retention_prune_runs/);

    expect(analyticsIds()).toEqual(["e1"]);
  });

  it("refuses when migration 032 has not seeded a policy row", () => {
    // The state a database is in if the applier were ever unwired, which
    // docs/running/migration.md warns is silent by construction. Refusing beats guessing
    // a window from a default nobody chose.
    event("2019-01-01 00:00:00");
    testDb!.prepare("DELETE FROM retention_policy").run();

    const report = runRetentionPrune({
      apply: false,
      captureProgression: captureNow,
      log: () => undefined,
    });

    expect(report.tables.map((t) => t.outcome)).toEqual(["refused", "refused"]);
    expect(report.tables[0].detail).toMatch(/no retention policy row/);
    expect(analyticsIds()).toHaveLength(1);

    const status = readRetentionStatus();
    expect(status.every((s) => s.policyMissing)).toBe(true);
    // It falls back to the declared default for display only; nothing acts on it.
    expect(status[0].retainDays).toBe(400);
    expect(status.every((s) => !s.enabled && !s.splitDue)).toBe(true);
  });

  it("lists both declared policies in the order they are pruned", () => {
    expect(readRetentionPolicies().map((p) => p.table)).toEqual([
      "analytics_events",
      "chat_messages",
    ]);
    expect(readRetentionPolicies().every((p) => !p.enabled)).toBe(true);
  });
});

describe("status keeps the WG-ARCH-008 split threshold observable", () => {
  it("reports the declared law, the live volume and the oldest row", () => {
    event("2019-01-01 00:00:00");
    event("2026-08-01 00:00:00");

    const status = readRetentionStatus();
    const analytics = status.find((s) => s.table === "analytics_events")!;

    expect(analytics.enabled).toBe(false);
    expect(analytics.policyMissing).toBe(false);
    expect(analytics.retainDays).toBe(400);
    expect(analytics.rows).toBe(2);
    expect(analytics.oldestRow).toBe("2019-01-01 00:00:00");
    expect(analytics.law.splitThresholdRows).toBe(1_000_000);
    expect(analytics.splitDue).toBe(false);
  });

  it("does not call the split due while retention is switched off", () => {
    // Retention is the cheap answer and has to be tried first. A table over the
    // line with the prune disabled has not proved that volume forced anything.
    setRetentionPolicy("analytics_events", { enabled: false });
    const status = readRetentionStatus().find((s) => s.table === "analytics_events")!;
    expect(status.splitDue).toBe(false);
  });
});
