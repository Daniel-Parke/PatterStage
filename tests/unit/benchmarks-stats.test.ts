/** @jest-environment node */
// Pure JRPG stat engine (benchmarks/stats.ts).

import {
  computeStatCard,
  ratingFromStatCard,
  capabilityFromStatCard,
  operationalFromStatCard,
  mergeStatCards,
} from "@/lib/benchmarks/stats";
import type { StatCard } from "@/lib/benchmarks/types";
import type { ResultForAgg } from "@/lib/benchmarks/score";
import type { StatCard } from "@/lib/benchmarks/types";

function r(over: Partial<ResultForAgg>): ResultForAgg {
  return {
    domain: "maths",
    itemId: "x",
    score: 1,
    canonical: null,
    latencyMs: 1000,
    errored: false,
    ...over,
  };
}

describe("computeStatCard", () => {
  it("gives a flawless agent ~100 across the board", () => {
    const inputs: ResultForAgg[] = [
      r({ itemId: "m1", domain: "maths", score: 1, statTags: { intelligence: 1 } }),
      r({ itemId: "i1", domain: "instruction", score: 1, statTags: { wisdom: 1, strength: 0.3 } }),
      r({ itemId: "c1", domain: "consistency", score: null, canonical: "A" }),
      r({ itemId: "c1", domain: "consistency", score: null, canonical: "A" }),
    ];
    const { card, errorRate } = computeStatCard(inputs);
    expect(errorRate).toBe(0);
    expect(card.strength).toBe(100);
    expect(card.intelligence).toBe(100);
    expect(card.wisdom).toBe(100);
    expect(card.dexterity).toBe(100);
    expect(card.fortitude).toBe(100);
    expect(card.speed).toBeGreaterThanOrEqual(95);
    expect(ratingFromStatCard(card)).toBeGreaterThanOrEqual(99);
  });

  it("drops Fortitude + Strength when executions error", () => {
    const inputs: ResultForAgg[] = [
      r({ itemId: "m1", domain: "maths", score: 1, statTags: { intelligence: 1 } }),
      r({ itemId: "m2", domain: "maths", score: 0, errored: true, latencyMs: null, statTags: { intelligence: 1 } }),
    ];
    const { card, errorRate } = computeStatCard(inputs);
    expect(errorRate).toBeCloseTo(0.5, 6);
    expect(card.strength).toBe(25); // overallMean 0.5 × completion 0.5
    expect(card.fortitude).toBe(50); // 1 - errorRate (no consistency items)
    expect(card.intelligence).toBe(50); // weighted mean of 1 and 0
  });

  it("Intelligence falls back to the overall mean when nothing is tagged", () => {
    const inputs: ResultForAgg[] = [
      r({ itemId: "a", domain: "maths", score: 0.8 }),
      r({ itemId: "b", domain: "maths", score: 0.6 }),
    ];
    const { card } = computeStatCard(inputs);
    expect(card.intelligence).toBe(70); // mean(0.8,0.6)=0.7
    expect(card.wisdom).toBe(70);
  });

  it("Dexterity rewards breadth across distinct task types", () => {
    // 3 domains, 2 competent (≥0.5) → 2/3
    const inputs: ResultForAgg[] = [
      r({ itemId: "a", domain: "maths", score: 0.9 }),
      r({ itemId: "b", domain: "logic", score: 0.7 }),
      r({ itemId: "c", domain: "needle", score: 0.2 }),
    ];
    const { card } = computeStatCard(inputs);
    expect(card.dexterity).toBe(67); // round(2/3 × 100)
  });

  it("returns a zeroed card for no inputs", () => {
    const { card, errorRate } = computeStatCard([]);
    expect(errorRate).toBe(0);
    expect(Object.values(card).every((v) => v === 0)).toBe(true);
  });
});

describe("mergeStatCards + ratingFromStatCard", () => {
  it("averages cards stat-by-stat", () => {
    const a: StatCard = { strength: 80, dexterity: 60, intelligence: 100, wisdom: 40, fortitude: 90, speed: 70 };
    const b: StatCard = { strength: 60, dexterity: 80, intelligence: 80, wisdom: 60, fortitude: 70, speed: 50 };
    const merged = mergeStatCards([a, b])!;
    expect(merged.strength).toBe(70);
    expect(merged.intelligence).toBe(90);
    expect(ratingFromStatCard(merged)).toBe(Math.round((70 + 70 + 90 + 50 + 80 + 60) / 6));
  });

  it("merges to null for an empty list", () => {
    expect(mergeStatCards([])).toBeNull();
  });
});

// ── ADR-0004: capability must not move when only the Brain's speed changes ──
describe("capabilityFromStatCard", () => {
  const card = (over: Partial<StatCard> = {}): StatCard => ({
    strength: 70,
    dexterity: 70,
    intelligence: 90,
    wisdom: 50,
    fortitude: 80,
    speed: 60,
    ...over,
  });

  it("excludes speed from the headline number", () => {
    // mean of the five capability stats, NOT all six
    expect(capabilityFromStatCard(card())).toBe(Math.round((70 + 70 + 90 + 50 + 80) / 5));
  });

  it("is unchanged when latency changes from worst to best", () => {
    const slow = capabilityFromStatCard(card({ speed: 0 }));
    const fast = capabilityFromStatCard(card({ speed: 100 }));
    expect(slow).toBe(fast);
  });

  it("still moves when real capability changes", () => {
    expect(capabilityFromStatCard(card({ intelligence: 10 }))).toBeLessThan(
      capabilityFromStatCard(card({ intelligence: 90 })),
    );
  });

  it("reports latency separately rather than hiding it", () => {
    expect(operationalFromStatCard(card({ speed: 42 }))).toEqual({ speed: 42 });
  });

  it("the deprecated blended rating is measurably different", () => {
    // Kept only to explain historical stored values; must not equal capability.
    expect(ratingFromStatCard(card({ speed: 0 }))).not.toBe(capabilityFromStatCard(card({ speed: 0 })));
  });
});
