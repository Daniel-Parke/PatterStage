/** @jest-environment node */

// B4 (T-0098) oracle, the derive half: RawMetrics carries a per-type ledger
// and the store facts the quest evaluator (B17) reads, and Completionist is
// measured from that ledger against the curated list, not from "distinct
// event types" against a literal 14. A failure recorded a hundred times still
// earns nothing; a type recorded zero times is not "triggered".

import { ACHIEVEMENT_DEFS, evaluateAchievements, type RawMetrics } from "@/lib/stats/derive";
import { COMPLETIONIST_EVENT_TYPES, type AnalyticsEventType } from "@/lib/analytics/event-types";

const base = (over: Partial<RawMetrics> = {}): RawMetrics => ({
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

const counts = (types: readonly AnalyticsEventType[], n = 1): Partial<Record<AnalyticsEventType, number>> =>
  Object.fromEntries(types.map((t) => [t, n]));

const completionist = () => ACHIEVEMENT_DEFS.find((d) => d.id === "completionist")!;
const measure = (m: RawMetrics) => evaluateAchievements(m).find((a) => a.id === "completionist")!;

describe("Completionist", () => {
  it("targets the curated list's length and says that number in its description", () => {
    const def = completionist();
    expect(def.target).toBe(COMPLETIONIST_EVENT_TYPES.length);
    expect(def.description).toContain(String(COMPLETIONIST_EVENT_TYPES.length));
    expect(def.description).not.toContain("14");
  });

  it("counts curated types with at least one event, and ignores distinctEventTypes", () => {
    expect(measure(base({ distinctEventTypes: 999 })).current).toBe(0);
    const all = measure(base({ eventCounts: counts(COMPLETIONIST_EVENT_TYPES) }));
    expect(all.current).toBe(COMPLETIONIST_EVENT_TYPES.length);
    expect(all.unlocked).toBe(true);
  });

  it("does not credit failures, types recorded zero times, or types outside the list", () => {
    const failures = measure(
      // The fourth is the not-yet-emitted example. It was help.opened until
      // T-0110 wired the Help page to emit it, which promoted it into the
      // curated list; research.cancelled is what is left outside.
      base({
        eventCounts: {
          "mission.failed": 5,
          "research.failed": 2,
          "composer.run_failed": 1,
          "research.cancelled": 3,
        },
      }),
    );
    expect(failures.current).toBe(0);
    expect(measure(base({ eventCounts: counts(COMPLETIONIST_EVENT_TYPES, 0) })).current).toBe(0);
    const allButOne = measure(base({ eventCounts: counts(COMPLETIONIST_EVENT_TYPES.slice(1)) }));
    expect(allButOne.current).toBe(COMPLETIONIST_EVENT_TYPES.length - 1);
    expect(allButOne.unlocked).toBe(false);
  });

  it("leaves Renaissance on breadth: eight distinct types of any kind", () => {
    const r = evaluateAchievements(base({ distinctEventTypes: 8 })).find((a) => a.id === "renaissance")!;
    expect(r.current).toBe(8);
    expect(r.unlocked).toBe(true);
  });
});

describe("RawMetrics", () => {
  it("carries the ledger and the store facts and every achievement still evaluates", () => {
    const m = base({
      eventCounts: { "profile.created": 2 },
      facts: { profiles: 2, models: 1, credentials: 1, workflows: 3, memoryConfigured: true },
    });
    expect(m.eventCounts["profile.created"]).toBe(2);
    expect(m.facts).toEqual({ profiles: 2, models: 1, credentials: 1, workflows: 3, memoryConfigured: true });
    const out = evaluateAchievements(m);
    expect(out).toHaveLength(ACHIEVEMENT_DEFS.length);
    for (const a of out) expect(Number.isFinite(a.current)).toBe(true);
  });
});
