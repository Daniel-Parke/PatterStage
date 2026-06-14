/** @jest-environment node */
import {
  computeXp,
  computeLevel,
  computeStreaks,
  evaluateAchievements,
  successRate,
  type RawMetrics,
} from "@/lib/stats/derive";

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
  ...over,
});

describe("computeXp", () => {
  it("sums weighted work into XP", () => {
    expect(computeXp({ completedMissions: 2, completedRuns: 4, stories: 1, totalTokens: 5000 })).toBe(
      2 * 100 + 4 * 25 + 1 * 150 + 5, // 200 + 100 + 150 + 5
    );
  });
  it("is zero for no work", () => {
    expect(computeXp({ completedMissions: 0, completedRuns: 0, stories: 0, totalTokens: 0 })).toBe(0);
  });
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
});

describe("successRate", () => {
  it("is zero with no terminal missions", () => {
    expect(successRate(0, 0)).toBe(0);
  });
  it("computes the fraction", () => {
    expect(successRate(3, 1)).toBe(0.75);
  });
});
