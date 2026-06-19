/** @jest-environment node */
// Pure uplift metric (benchmarks/uplift.ts) — the hypothesis test.

import { computeUplift } from "@/lib/benchmarks/uplift";
import type { ResultForAgg } from "@/lib/benchmarks/score";

function r(itemId: string, domain: ResultForAgg["domain"], score: number | null, canonical: string | null = null): ResultForAgg {
  return { itemId, domain, score, canonical };
}

describe("computeUplift", () => {
  it("is positive when the augmented agent beats its brain-only baseline", () => {
    const aug = [r("a", "maths", 1), r("b", "instruction", 1)];
    const brain = [r("a", "maths", 0), r("b", "instruction", 0.5)];
    const u = computeUplift(aug, brain);
    expect(u.sharedItems).toBe(2);
    expect(u.overall).toBe(75); // mean(+1, +0.5) = 0.75 → 75
  });

  it("is negative when augmentation hurts", () => {
    const u = computeUplift([r("a", "maths", 0.2)], [r("a", "maths", 0.9)]);
    expect(u.overall).toBe(-70);
  });

  it("only counts items present in both runs", () => {
    const aug = [r("a", "maths", 1), r("only-aug", "logic", 1)];
    const brain = [r("a", "maths", 0)];
    const u = computeUplift(aug, brain);
    expect(u.sharedItems).toBe(1);
    expect(u.overall).toBe(100);
  });

  it("reports per-domain deltas and handles consistency via agreement", () => {
    const aug = [r("c", "consistency", null, "A"), r("c", "consistency", null, "A")];
    const brain = [r("c", "consistency", null, "A"), r("c", "consistency", null, "B")];
    const u = computeUplift(aug, brain);
    // aug agreement 1.0, brain agreement 0.5 → +0.5
    expect(u.overall).toBe(50);
    expect(u.perDomain).toEqual([{ domain: "consistency", delta: 50 }]);
  });
});
