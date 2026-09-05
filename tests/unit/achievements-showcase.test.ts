/** @jest-environment node */
// Tier derivation (derive.ts) + showcase selectors (achievements-showcase.ts).

import {
  evaluateAchievements,
  achievementTier,
  achievementPoints,
  TIER_POINTS,
  type Achievement,
  type RawMetrics,
} from "@/lib/stats/derive";
import {
  summarizeAchievements,
  selectShowcase,
  byRarity,
} from "@/lib/achievements-showcase";

function ach(over: Partial<Achievement>): Achievement {
  return {
    id: "x",
    name: "X",
    description: "",
    icon: "Trophy",
    color: "cyan",
    unlocked: false,
    progress: 0,
    current: 0,
    target: 1,
    tier: "common",
    points: 10,
    ...over,
  };
}

describe("achievement tiers", () => {
  it("maps curated ids to tiers and defaults the rest to common", () => {
    expect(achievementTier("centurion")).toBe("legendary");
    expect(achievementTier("veteran")).toBe("epic");
    expect(achievementTier("field-agent")).toBe("rare");
    expect(achievementTier("first-contact")).toBe("common");
    expect(achievementTier("does-not-exist")).toBe("common");
  });
  it("derives points from tier", () => {
    expect(achievementPoints("centurion")).toBe(TIER_POINTS.legendary);
    expect(achievementPoints("first-contact")).toBe(TIER_POINTS.common);
  });
  it("evaluateAchievements stamps tier + points on every DTO", () => {
    // `facts` is part of the shape too: B17's chain achievements measure the
    // quest proofs, and two of those proofs are store facts rather than events.
    const m = {
      completedMissions: 1,
      completionHours: [],
      eventCounts: {},
      facts: { profiles: 0, models: 0, credentials: 0, workflows: 0, memoryConfigured: false },
    } as unknown as RawMetrics;
    const list = evaluateAchievements(m);
    const fc = list.find((a) => a.id === "first-contact")!;
    expect(fc.tier).toBe("common");
    expect(fc.points).toBe(TIER_POINTS.common);
    expect(fc.unlocked).toBe(true);
  });
});

describe("summarizeAchievements", () => {
  it("counts unlocked/total + earned/total points + per-tier", () => {
    const list = [
      ach({ id: "a", tier: "legendary", points: 100, unlocked: true }),
      ach({ id: "b", tier: "rare", points: 25, unlocked: false }),
      ach({ id: "c", tier: "common", points: 10, unlocked: true }),
    ];
    const s = summarizeAchievements(list);
    expect(s.unlocked).toBe(2);
    expect(s.total).toBe(3);
    expect(s.points).toBe(110);
    expect(s.totalPoints).toBe(135);
    expect(s.byTier.legendary).toEqual({ unlocked: 1, total: 1 });
    expect(s.byTier.rare).toEqual({ unlocked: 0, total: 1 });
  });
});

describe("selectShowcase + byRarity", () => {
  const list = [
    ach({ id: "leg", tier: "legendary", points: 100, unlocked: true }),
    ach({ id: "epic", tier: "epic", points: 50, unlocked: true }),
    ach({ id: "common", tier: "common", points: 10, unlocked: true }),
    ach({ id: "near1", tier: "rare", unlocked: false, progress: 0.9 }),
    ach({ id: "near2", tier: "epic", unlocked: false, progress: 0.4 }),
    ach({ id: "locked0", tier: "common", unlocked: false, progress: 0 }),
  ];

  it("features rarest unlocked first", () => {
    const { featured } = selectShowcase(list, { featuredCount: 2 });
    expect(featured.map((a) => a.id)).toEqual(["leg", "epic"]);
  });

  it("picks locked achievements with the highest progress as nearest", () => {
    const { nearest } = selectShowcase(list, { nearestCount: 2 });
    expect(nearest.map((a) => a.id)).toEqual(["near1", "near2"]);
    // progress 0 excluded
    expect(nearest.find((a) => a.id === "locked0")).toBeUndefined();
  });

  it("byRarity sorts legendary before epic before common", () => {
    const sorted = [...list].filter((a) => a.unlocked).sort(byRarity);
    expect(sorted.map((a) => a.id)).toEqual(["leg", "epic", "common"]);
  });
});
