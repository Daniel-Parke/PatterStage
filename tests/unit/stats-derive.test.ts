/** @jest-environment node */
import {
  computeLevel,
  computeStreaks,
  evaluateAchievements,
  successRate,
  ACHIEVEMENT_DEFS,
  achievementScope,
  type RawMetrics,
} from "@/lib/stats/derive";
import { ICONS } from "@/components/achievements/AchievementBadge";
import { COMPLETIONIST_EVENT_TYPES } from "@/lib/analytics/event-types";

const baseMetrics = (over: Partial<RawMetrics> = {}): RawMetrics => ({
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
  ...over,
});

describe("computeLevel", () => {
  it("starts at level 1 with the first title", () => {
    const l = computeLevel(0);
    expect(l.level).toBe(1);
    expect(l.title).toBe("Initiate");
    expect(l.progress).toBe(0);
  });
  it("crosses to level 2 exactly at 100 XP (triangular curve)", () => {
    expect(computeLevel(99).level).toBe(1);
    expect(computeLevel(100).level).toBe(2);
  });
  it("reports progress within the current level", () => {
    // L2 spans [100, 300): halfway is 200.
    const l = computeLevel(200);
    expect(l.level).toBe(2);
    expect(l.xpForLevel).toBe(200);
    expect(l.xpIntoLevel).toBe(100);
    expect(l.progress).toBeCloseTo(0.5, 5);
  });
  it("clamps negative xp to level 1", () => {
    expect(computeLevel(-50).level).toBe(1);
  });
});

describe("computeStreaks", () => {
  const today = "2026-06-14";
  it("returns zero for no activity", () => {
    expect(computeStreaks([], today)).toEqual({ current: 0, longest: 0 });
  });
  it("counts a current run ending today", () => {
    expect(computeStreaks(["2026-06-12", "2026-06-13", "2026-06-14"], today)).toEqual({
      current: 3,
      longest: 3,
    });
  });
  it("keeps the streak alive when the last activity was yesterday", () => {
    expect(computeStreaks(["2026-06-12", "2026-06-13"], today).current).toBe(2);
  });
  it("breaks the current streak on a gap but keeps the longest", () => {
    const r = computeStreaks(["2026-06-09", "2026-06-10", "2026-06-11", "2026-06-14"], today);
    expect(r.current).toBe(1); // only today
    expect(r.longest).toBe(3); // 9-10-11
  });
  it("reports zero current when the most recent activity is older than yesterday", () => {
    expect(computeStreaks(["2026-06-10", "2026-06-11"], today).current).toBe(0);
  });
});

describe("evaluateAchievements", () => {
  it("unlocks first-contact at one completed mission", () => {
    const a = evaluateAchievements(baseMetrics({ completedMissions: 1 })).find((x) => x.id === "first-contact");
    expect(a?.unlocked).toBe(true);
    expect(a?.progress).toBe(1);
  });
  it("reports partial progress toward locked achievements", () => {
    const a = evaluateAchievements(baseMetrics({ completedMissions: 5 })).find((x) => x.id === "field-agent");
    expect(a?.unlocked).toBe(false);
    expect(a?.progress).toBeCloseTo(0.5, 5);
  });
  it("unlocks night-owl only for an early-morning completion", () => {
    expect(evaluateAchievements(baseMetrics({ completionHours: [14] })).find((x) => x.id === "night-owl")?.unlocked).toBe(false);
    expect(evaluateAchievements(baseMetrics({ completionHours: [3] })).find((x) => x.id === "night-owl")?.unlocked).toBe(true);
  });
  it("splits the time-of-day badges (night-owl vs early-bird) by hour window", () => {
    const am6 = evaluateAchievements(baseMetrics({ completionHours: [6] }));
    expect(am6.find((x) => x.id === "early-bird")?.unlocked).toBe(true);
    expect(am6.find((x) => x.id === "night-owl")?.unlocked).toBe(false);
  });
  it("starts every achievement locked at zero metrics", () => {
    const all = evaluateAchievements(baseMetrics());
    expect(all.every((a) => !a.unlocked && a.progress === 0)).toBe(true);
  });
  it("respects tiered ladders (field-agent before veteran before legend)", () => {
    const at10 = evaluateAchievements(baseMetrics({ completedMissions: 10 }));
    expect(at10.find((x) => x.id === "field-agent")?.unlocked).toBe(true);
    expect(at10.find((x) => x.id === "veteran")?.unlocked).toBe(false);
    expect(at10.find((x) => x.id === "legend")?.unlocked).toBe(false);
  });
  it("clamps progress at 1 when the metric exceeds the target", () => {
    const a = evaluateAchievements(baseMetrics({ completedMissions: 25 })).find((x) => x.id === "field-agent");
    expect(a?.progress).toBe(1);
  });
  it.each([
    ["blitz", { maxMissionsInADay: 5 }],
    ["dispatcher", { dispatchedMissions: 50 }],
    ["chatterbox", { chatMessages: 1000 }],
    ["cron-lord", { schedulesFired: 500 }],
    ["polyglot", { distinctProfiles: 3 }],
    // The ledger, not the distinct count: one of each curated type (T-0098).
    ["completionist", { eventCounts: Object.fromEntries(COMPLETIONIST_EVENT_TYPES.map((t) => [t, 1])) }],
  ])("unlocks the event-derived achievement %s at its threshold", (id, over) => {
    const a = evaluateAchievements(baseMetrics(over as Partial<RawMetrics>)).find((x) => x.id === id);
    expect(a?.unlocked).toBe(true);
  });
});

describe("ACHIEVEMENT_DEFS catalogue integrity", () => {
  it("has ~36 achievements with unique ids and positive targets", () => {
    expect(ACHIEVEMENT_DEFS.length).toBeGreaterThanOrEqual(36);
    const ids = ACHIEVEMENT_DEFS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ACHIEVEMENT_DEFS.every((d) => d.target > 0 && d.name && d.description)).toBe(true);
  });
  it("every icon is registered in AchievementBadge.ICONS (no silent Medal fallback)", () => {
    const missing = ACHIEVEMENT_DEFS.filter((d) => !(d.icon in ICONS)).map((d) => `${d.id}:${d.icon}`);
    expect(missing).toEqual([]);
  });
  it("uses only the supported neon accent colours", () => {
    const allowed = new Set(["cyan", "purple", "pink", "green", "orange", "yellow"]);
    const bad = ACHIEVEMENT_DEFS.filter((d) => !allowed.has(d.color)).map((d) => `${d.id}:${d.color}`);
    expect(bad).toEqual([]);
  });
});

describe("successRate", () => {
  it("is zero with no terminal missions", () => {
    expect(successRate(0, 0)).toBe(0);
  });
  it("computes the fraction", () => {
    expect(successRate(3, 1)).toBe(0.75);
  });
});

// ── ADR-0004: Brain vs Body ──────────────────────────────────────────────
describe("achievement scope", () => {
  it("marks the story achievements as Rec Room, not agent progression", () => {
    const recroom = ACHIEVEMENT_DEFS.filter((d) => achievementScope(d) === "recroom");
    expect(recroom.map((d) => d.id).sort()).toEqual([
      // Curriculum is every quest, and chapter 6 of the programme is the Rec
      // Room, so an agent scope would let a story written for fun move the
      // Body's record (B17).
      "curriculum",
      "epic-scribe",
      "novelist",
      "saga-weaver",
      "storyteller",
      "wordsmith",
    ]);
  });

  it("defaults everything else to the agent record", () => {
    const agent = ACHIEVEMENT_DEFS.filter((d) => achievementScope(d) === "agent");
    expect(agent.length).toBeGreaterThan(20);
    // No agent achievement may be measured from a Rec Room counter.
    const recroomKeys = ["stories", "storiesCompleted", "chaptersGenerated"] as const;
    for (const def of agent) {
      for (const key of recroomKeys) {
        const probe = baseMetrics({ [key]: 10_000 });
        expect(def.measure(probe)).toBe(def.measure(baseMetrics()));
      }
    }
  });
});
