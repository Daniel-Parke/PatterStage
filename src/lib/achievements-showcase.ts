// ═══════════════════════════════════════════════════════════════
// achievements-showcase.ts — pure selectors for the compact achievements
// "trophy case": summarise totals/points and pick the featured set
// (rarest unlocked + nearest-to-unlock). Used by AchievementShowcase.
// ═══════════════════════════════════════════════════════════════

import type { Achievement, AchievementTier } from "@/lib/stats/derive";

/** Rarity ordering (legendary is rarest/most valuable). */
const TIER_RANK: Record<AchievementTier, number> = {
  legendary: 4,
  epic: 3,
  rare: 2,
  common: 1,
};

export const TIER_LABEL: Record<AchievementTier, string> = {
  legendary: "Legendary",
  epic: "Epic",
  rare: "Rare",
  common: "Common",
};

/** Neon color per tier (keys into the NeonColor palette). */
export const TIER_COLOR: Record<AchievementTier, string> = {
  legendary: "yellow",
  epic: "pink",
  rare: "purple",
  common: "cyan",
};

export interface AchievementSummary {
  unlocked: number;
  total: number;
  /** Points earned (sum of unlocked points). */
  points: number;
  /** Max points possible (sum of all points). */
  totalPoints: number;
  /** Per-tier unlocked/total counts. */
  byTier: Record<AchievementTier, { unlocked: number; total: number }>;
}

export function summarizeAchievements(list: Achievement[]): AchievementSummary {
  const byTier: Record<AchievementTier, { unlocked: number; total: number }> = {
    legendary: { unlocked: 0, total: 0 },
    epic: { unlocked: 0, total: 0 },
    rare: { unlocked: 0, total: 0 },
    common: { unlocked: 0, total: 0 },
  };
  let unlocked = 0;
  let points = 0;
  let totalPoints = 0;
  for (const a of list) {
    byTier[a.tier].total += 1;
    totalPoints += a.points;
    if (a.unlocked) {
      byTier[a.tier].unlocked += 1;
      unlocked += 1;
      points += a.points;
    }
  }
  return { unlocked, total: list.length, points, totalPoints, byTier };
}

/** Rarest-first sort for unlocked achievements (tier → points → name). */
export function byRarity(a: Achievement, b: Achievement): number {
  return (
    TIER_RANK[b.tier] - TIER_RANK[a.tier] ||
    b.points - a.points ||
    a.name.localeCompare(b.name)
  );
}

export interface ShowcaseSelection {
  /** Rarest unlocked achievements, most-valuable first. */
  featured: Achievement[];
  /** Locked achievements closest to unlocking (progress desc). */
  nearest: Achievement[];
}

/**
 * Pick the compact-view set: the rarest *unlocked* trophies + the
 * locked ones the operator is closest to earning.
 */
export function selectShowcase(
  list: Achievement[],
  opts: { featuredCount?: number; nearestCount?: number } = {},
): ShowcaseSelection {
  const featuredCount = opts.featuredCount ?? 5;
  const nearestCount = opts.nearestCount ?? 4;

  const featured = list
    .filter((a) => a.unlocked)
    .sort(byRarity)
    .slice(0, featuredCount);

  const nearest = list
    .filter((a) => !a.unlocked && a.progress > 0)
    .sort(
      (a, b) =>
        b.progress - a.progress || TIER_RANK[b.tier] - TIER_RANK[a.tier],
    )
    .slice(0, nearestCount);

  return { featured, nearest };
}
