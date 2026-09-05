/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports -- the modules under contract do not exist yet; a static import would fail typecheck:tests instead of failing this test for the contract reason */

// ═══════════════════════════════════════════════════════════════
// B17 oracle, the derivation half: every quest's proof, one at a time.
//
// Contract §1, §2 and §3. `evaluateQuests(raw, latch, nowIso)` is PURE — no
// database, no clock, no env — and turns the ledger the B4 stats reader
// already measures (`RawMetrics.eventCounts` + `RawMetrics.facts`) into a
// per-quest answer.
//
// The expectation table below is written out by hand rather than read off
// QUEST_DEFS, because a test that derives its expectations from the thing it
// is testing proves only that the module agrees with itself. These thirty-two
// rows ARE the content contract: the id, the chapter, the proof, and nothing
// else in the tree may move them.
//
// Chapter 4 carries FOUR quests, not six. "Read its artifact" and "read the
// logs" have no proof: B4's taxonomy records writes only ("emitted only after
// its write succeeded and only from a write path"), so there is no read event
// and inventing one reopens a taxonomy B4 closed. Contract §1 rules them out
// of the chain and into chapter 4's untracked `seeAlso` links. Quest 2.1 and
// quest 4.4 are the two survivors of that rule, and they are proven by the
// NEAREST existing event, which is why their rows carry a comment saying what
// the proof can and cannot see.
//
// Written before src/lib/quests/ exists, so the whole file is red until
// `@/lib/quests/quest-defs` and `@/lib/quests/evaluate` resolve.
// ═══════════════════════════════════════════════════════════════

import type { AnalyticsEventType } from "@/lib/analytics/event-types";
import type { RawMetrics, StoreFacts } from "@/lib/stats/derive";

// ── the shapes the contract names ───────────────────────────────

type QuestProof =
  | { kind: "event"; event: AnalyticsEventType; target: number }
  | { kind: "fact"; fact: keyof StoreFacts; target: number };

interface QuestState {
  id: string;
  chapter: number;
  title: string;
  action: string;
  screen: string;
  proof: QuestProof;
  met: boolean;
  completed: boolean;
  completedAt: string | null;
  skipped: boolean;
}

interface QuestProgress {
  chapters: Array<{ number: number; id: string; title: string; total: number; completed: number }>;
  quests: QuestState[];
  completed: number;
  total: number;
  nextCompletedAt: Record<string, string>;
  latchChanged: boolean;
  seeding: boolean;
}

interface QuestLatch {
  completedAt: Record<string, string>;
  skipped: string[];
  seeded: boolean;
}

type EvaluateQuests = (m: RawMetrics, latch: QuestLatch, nowIso: string) => QuestProgress;

function evaluate(): EvaluateQuests {
  return (require("@/lib/quests/evaluate") as { evaluateQuests: EvaluateQuests }).evaluateQuests;
}

function defs(): Array<{ id: string; chapter: number; proof: QuestProof }> {
  return (require("@/lib/quests/quest-defs") as {
    QUEST_DEFS: Array<{ id: string; chapter: number; proof: QuestProof }>;
  }).QUEST_DEFS;
}

// ── fixtures ────────────────────────────────────────────────────

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

const EMPTY_LATCH: QuestLatch = { completedAt: {}, skipped: [], seeded: true };
const NOW = "2026-09-05T12:00:00.000Z";

/** Metrics in which EXACTLY this proof is satisfied and nothing else is set. */
function metricsFor(proof: QuestProof, count = proof.target): RawMetrics {
  const m = baseMetrics();
  if (proof.kind === "event") {
    m.eventCounts[proof.event] = count;
    return m;
  }
  if (proof.fact === "memoryConfigured") {
    m.facts.memoryConfigured = count > 0;
    return m;
  }
  (m.facts as unknown as Record<string, number>)[proof.fact] = count;
  return m;
}

/**
 * The two ids this batch ADDS to the taxonomy, named here so the file
 * typechecks before they land.
 *
 * `npm run typecheck:tests` runs inside `npm run lint`, and an oracle that
 * breaks the typechecker is not an oracle, it is a broken build. The union
 * collapses to AnalyticsEventType the moment event-types.ts carries them, and
 * the integrity oracle is what checks that it did.
 */
type PendingEventType = AnalyticsEventType | "artifact.opened" | "logs.opened";

const ev = (event: PendingEventType, target = 1): QuestProof =>
  ({ kind: "event", event: event as AnalyticsEventType, target });
const fact = (f: keyof StoreFacts, target = 1): QuestProof => ({ kind: "fact", fact: f, target });

/** The content contract: thirty-two quests, seven chapters, one proof each. */
const EXPECTED: ReadonlyArray<{ id: string; chapter: number; proof: QuestProof }> = [
  // ── 1 Get running ──
  { id: "1.1", chapter: 1, proof: ev("model.added") },
  // Decision 18 is binding: 1.2 is proven by credential.added. A keyless
  // provider needs none, which is the quest Skip exists for.
  { id: "1.2", chapter: 1, proof: ev("credential.added") },
  { id: "1.3", chapter: 1, proof: ev("chat.message_sent") },
  { id: "1.4", chapter: 1, proof: ev("mission.dispatched") },
  { id: "1.5", chapter: 1, proof: ev("mission.completed") },

  // ── 2 Missions ──
  // No event carries the template: eventCounts is per-type and metadata-free.
  // The nearest existing proof is a SECOND dispatch (1.4 was the first).
  { id: "2.1", chapter: 2, proof: ev("mission.dispatched", 2) },
  { id: "2.2", chapter: 2, proof: ev("template.saved") },
  { id: "2.3", chapter: 2, proof: ev("schedule.created") },
  { id: "2.4", chapter: 2, proof: ev("schedule.fired") },
  { id: "2.5", chapter: 2, proof: ev("mission.cancelled") },

  // ── 3 Shape your agent ──
  { id: "3.1", chapter: 3, proof: fact("profiles", 2) },
  { id: "3.2", chapter: 3, proof: ev("personality.changed") },
  { id: "3.3", chapter: 3, proof: ev("skill.toggled") },
  { id: "3.4", chapter: 3, proof: ev("toolset.saved") },
  { id: "3.5", chapter: 3, proof: ev("config.saved") },
  // The store fact, not memory.configured: the fact already tells an
  // operator's save from migration 031's seeded Hindsight guess.
  { id: "3.6", chapter: 3, proof: fact("memoryConfigured", 1) },
  { id: "3.7", chapter: 3, proof: ev("memory.retained") },
  { id: "3.8", chapter: 3, proof: ev("profile.pushed") },

  // ── 4 Automate and watch ──
  { id: "4.1", chapter: 4, proof: ev("script.saved") },
  { id: "4.2", chapter: 4, proof: ev("script.run") },
  { id: "4.3", chapter: 4, proof: ev("script.scheduled") },
  // Reading is not a write path, so nothing records a transcript being READ.
  // The nearest proof is that one ARRIVED, which is what the action sentence
  // must say.
  { id: "4.4", chapter: 4, proof: ev("session.started") },
  // 4.5 and 4.6 are the OPERATOR'S RULING of 2026-09-06, taken while B16 ran.
  // This file was written asking for it: reading had no proof, and the three
  // ways out were to ship four quests here, to add two read events, or to swap
  // the steps for writes that are not what the plan meant. The operator chose
  // the read events, so the ledger now records two reads and the programme
  // ships thirty-two quests rather than thirty.
  //
  // They are emitted SERVER-side from the GET handlers the two screens already
  // call, the way help.opened is emitted from the Help page's own render. Not
  // from the client: there is deliberately no POST on /api/analytics, because a
  // client that could write the ledger could forge the progress that reads it.
  { id: "4.5", chapter: 4, proof: ev("artifact.opened") },
  { id: "4.6", chapter: 4, proof: ev("logs.opened") },

  // ── 5 Multi-stage work ──
  { id: "5.1", chapter: 5, proof: ev("composer.run_started") },
  { id: "5.2", chapter: 5, proof: ev("composer.gate_approved") },
  { id: "5.3", chapter: 5, proof: ev("research.started") },
  { id: "5.4", chapter: 5, proof: ev("artifact.saved") },

  // ── 6 Rec Room ──
  { id: "6.1", chapter: 6, proof: ev("story.created") },
  { id: "6.2", chapter: 6, proof: ev("story.chapter_generated") },
  { id: "6.3", chapter: 6, proof: ev("story.completed") },

  // ── 7 Keep it healthy ──
  { id: "7.1", chapter: 7, proof: ev("backup.taken") },
];

function stateOf(p: QuestProgress, id: string): QuestState {
  const q = p.quests.find((x) => x.id === id);
  if (!q) throw new Error(`no quest ${id} in the progress; ids: ${p.quests.map((x) => x.id).join(", ")}`);
  return q;
}

// ── the catalogue is the thirty-two rows above ──────────────────

describe("QUEST_DEFS is the content contract", () => {
  it("ships thirty-two quests across seven chapters, with the ids the plan addresses", () => {
    expect(defs().map((d) => d.id)).toEqual(EXPECTED.map((e) => e.id));
  });

  it("puts every quest in the chapter the plan names", () => {
    const byId = new Map(defs().map((d) => [d.id, d.chapter]));
    for (const e of EXPECTED) expect([e.id, byId.get(e.id)]).toEqual([e.id, e.chapter]);
  });

  it("chapter 4 carries six quests, two of them proved by the new read events", () => {
    // The operator's ruling. Before it, reading had no proof and this chapter
    // was going to ship four; artifact.opened and logs.opened are the first
    // read-tracking events in a taxonomy that had recorded only writes.
    expect(defs().filter((d) => d.chapter === 4).map((d) => d.id)).toEqual([
      "4.1",
      "4.2",
      "4.3",
      "4.4",
      "4.5",
      "4.6",
    ]);
  });

  it("proves each quest with exactly the proof the contract pins", () => {
    const byId = new Map(defs().map((d) => [d.id, d.proof]));
    for (const e of EXPECTED) expect([e.id, byId.get(e.id)]).toEqual([e.id, e.proof]);
  });
});

// ── one fixture per quest ───────────────────────────────────────

describe("evaluateQuests derives each proof from the ledger", () => {
  it("says nothing is met on a fresh install", () => {
    const out = evaluate()(baseMetrics(), EMPTY_LATCH, NOW);
    expect(out.quests.filter((q) => q.met)).toEqual([]);
    expect(out.completed).toBe(0);
    expect(out.total).toBe(EXPECTED.length);
  });

  for (const e of EXPECTED) {
    it(`quest ${e.id} completes on its own proof and on nothing else`, () => {
      const out = evaluate()(metricsFor(e.proof), EMPTY_LATCH, NOW);
      const q = stateOf(out, e.id);
      expect(q.met).toBe(true);
      expect(q.completed).toBe(true);
      expect(q.completedAt).toBe(NOW);
      // Nothing outside this quest's own proof may tick. The one legitimate
      // overlap is a smaller target on the same event (2.1 implies 1.4).
      const alsoMet = out.quests.filter((x) => x.met && x.id !== e.id);
      for (const other of alsoMet) {
        expect({ id: other.id, proof: other.proof }).toEqual({
          id: other.id,
          proof: expect.objectContaining(
            e.proof.kind === "event" ? { kind: "event", event: e.proof.event } : { kind: "fact", fact: e.proof.fact },
          ),
        });
      }
    });
  }

  it("counts, it does not merely check for presence: one short of the target is not met", () => {
    for (const e of EXPECTED) {
      if (e.proof.target < 2) continue;
      const out = evaluate()(metricsFor(e.proof, e.proof.target - 1), EMPTY_LATCH, NOW);
      expect([e.id, stateOf(out, e.id).met]).toEqual([e.id, false]);
    }
  });

  it("reads a boolean store fact as a boolean, never as a truthy zero", () => {
    const off = evaluate()(baseMetrics(), EMPTY_LATCH, NOW);
    expect(stateOf(off, "3.6").met).toBe(false);
    const on = baseMetrics();
    on.facts.memoryConfigured = true;
    expect(stateOf(evaluate()(on, EMPTY_LATCH, NOW), "3.6").met).toBe(true);
  });

  it("is pure: the same inputs give the same answer, and it never reads the clock", () => {
    const m = metricsFor(ev("backup.taken"));
    const a = evaluate()(m, EMPTY_LATCH, NOW);
    const b = evaluate()(m, EMPTY_LATCH, NOW);
    expect(b).toEqual(a);
    // A different nowIso may only move the stamps, never the answer.
    const later = evaluate()(m, EMPTY_LATCH, "2027-01-01T00:00:00.000Z");
    expect(later.quests.map((q) => q.met)).toEqual(a.quests.map((q) => q.met));
    expect(stateOf(later, "7.1").completedAt).toBe("2027-01-01T00:00:00.000Z");
  });
});

// ── chapter arithmetic and the badge's n/N ──────────────────────

describe("the chapter roll-up and the n/N the rail shows", () => {
  it("counts a chapter's completions against that chapter's quests", () => {
    const m = baseMetrics();
    m.eventCounts["model.added"] = 1;
    m.eventCounts["credential.added"] = 1;
    const out = evaluate()(m, EMPTY_LATCH, NOW);
    const ch1 = out.chapters.find((c) => c.number === 1);
    expect(ch1).toEqual(expect.objectContaining({ total: 5, completed: 2 }));
    expect(out.completed).toBe(2);
    expect(out.total).toBe(EXPECTED.length);
  });

  it("names seven chapters, numbered 1 to 7, in order", () => {
    const out = evaluate()(baseMetrics(), EMPTY_LATCH, NOW);
    expect(out.chapters.map((c) => c.number)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(out.chapters.map((c) => c.id)).toEqual([
      "get-running",
      "missions",
      "shape-your-agent",
      "automate-and-watch",
      "multi-stage-work",
      "rec-room",
      "keep-it-healthy",
    ]);
  });

  it("takes a skipped quest out of the denominator, never out of the list", () => {
    const m = metricsFor(ev("backup.taken"));
    const out = evaluate()(m, { completedAt: {}, skipped: ["1.2"], seeded: true }, NOW);
    expect(out.total).toBe(EXPECTED.length - 1);
    expect(stateOf(out, "1.2").skipped).toBe(true);
    expect(out.quests).toHaveLength(EXPECTED.length);
  });

  it("keeps a quest blocked by an unavailable host in the denominator", () => {
    // The arithmetic is a property of this install's history, not of whether
    // a gateway happens to answer right now. `requires` changes the CARD
    // (contract §7), never the count.
    const out = evaluate()(baseMetrics(), EMPTY_LATCH, NOW);
    expect(out.total).toBe(EXPECTED.length);
  });
});
