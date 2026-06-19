// ═══════════════════════════════════════════════════════════════
// benchmarks/uplift.ts — the hypothesis metric (pure)
//
// The whole point of the tool is to answer: does the agent's config + skills +
// tools + memory lift performance over the SAME brain with none of it? Uplift is
// the per-item score delta between the augmented run and its brain-only baseline
// on the shared items. It is the headline "+N" and the basis for Wisdom (the
// ability to APPLY intelligence). Pure + unit-tested.
// ═══════════════════════════════════════════════════════════════

import type { BenchmarkDomain } from "./types";
import { modalAgreement, type ResultForAgg } from "./score";

const mean = (xs: number[]) => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);

/** Collapse per-(item,repeat) rows into a per-item score map (0–1). */
function itemScores(results: ResultForAgg[]): Map<string, { domain: BenchmarkDomain; score: number }> {
  const byItem = new Map<string, ResultForAgg[]>();
  for (const r of results) {
    const b = byItem.get(r.itemId) ?? [];
    b.push(r);
    byItem.set(r.itemId, b);
  }
  const out = new Map<string, { domain: BenchmarkDomain; score: number }>();
  for (const [itemId, bucket] of byItem) {
    const score =
      bucket[0].domain === "consistency"
        ? modalAgreement(bucket.map((x) => x.canonical))
        : mean(bucket.map((x) => x.score).filter((s): s is number => s !== null));
    out.set(itemId, { domain: bucket[0].domain, score });
  }
  return out;
}

export interface UpliftResult {
  /** Mean (augmented − baseline) over shared items, in 0–100 points. */
  overall: number;
  perDomain: Array<{ domain: BenchmarkDomain; delta: number }>;
  sharedItems: number;
}

/** Uplift of an augmented run over its brain-only baseline on shared items. */
export function computeUplift(augmented: ResultForAgg[], baseline: ResultForAgg[]): UpliftResult {
  const aug = itemScores(augmented);
  const base = itemScores(baseline);

  const deltas: number[] = [];
  const byDomain = new Map<BenchmarkDomain, number[]>();
  for (const [itemId, a] of aug) {
    const b = base.get(itemId);
    if (!b) continue;
    const delta = a.score - b.score;
    deltas.push(delta);
    const arr = byDomain.get(a.domain) ?? [];
    arr.push(delta);
    byDomain.set(a.domain, arr);
  }

  return {
    overall: Math.round(mean(deltas) * 100),
    perDomain: [...byDomain.entries()].map(([domain, ds]) => ({ domain, delta: Math.round(mean(ds) * 100) })),
    sharedItems: deltas.length,
  };
}
