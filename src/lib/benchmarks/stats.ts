// ═══════════════════════════════════════════════════════════════
// benchmarks/stats.ts — the JRPG stat card engine (pure)
//
// Turns per-(item,repeat) results into a 6-stat card (0–100 each). No DB, no
// IO — deterministic and unit-tested (mirrors stats/derive.ts + score.ts).
//
//   • Intelligence / Wisdom  — CONTENT stats: items tag which they inform.
//   • Strength               — completion × correctness across ALL items.
//   • Dexterity              — breadth: competence across DIFFERENT task types.
//   • Fortitude / Speed      — UNIVERSAL: from every run's completion/error +
//                              latency metadata, regardless of content.
//
// Designed to scale: hundreds of niche suites just tag their items; the rating
// layer merges multiple suites' card inputs into one holistic card.
// ═══════════════════════════════════════════════════════════════

import type { BenchmarkDomain, Stat, StatCard } from "./types";
import { modalAgreement, type ResultForAgg } from "./score";
import { aggregateMetrics, type ItemMetrics } from "./metrics";

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const pct = (x: number) => Math.round(clamp01(x) * 100);
const mean = (xs: number[]) => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);

interface ItemAgg {
  itemId: string;
  domain: BenchmarkDomain;
  statTags: Partial<Record<Stat, number>>;
  /** 0–1 final item score. */
  score: number;
  /** Mean latency across repeats (ms), or null when unknown. */
  latencyMs: number | null;
  /** Fraction of this item's repeats that errored. */
  errorRate: number;
}

/** Group per-(item,repeat) results into per-item aggregates. */
function aggregateItems(results: ResultForAgg[]): ItemAgg[] {
  const byItem = new Map<string, ResultForAgg[]>();
  for (const r of results) {
    const bucket = byItem.get(r.itemId) ?? [];
    bucket.push(r);
    byItem.set(r.itemId, bucket);
  }
  const out: ItemAgg[] = [];
  for (const bucket of byItem.values()) {
    const first = bucket[0];
    const score =
      first.domain === "consistency"
        ? modalAgreement(bucket.map((b) => b.canonical))
        : mean(bucket.map((b) => b.score).filter((s): s is number => s !== null));
    const latencies = bucket.map((b) => b.latencyMs).filter((l): l is number => typeof l === "number");
    const errored = bucket.filter((b) => b.errored === true).length;
    out.push({
      itemId: first.itemId,
      domain: first.domain,
      statTags: first.statTags ?? {},
      score,
      latencyMs: latencies.length ? mean(latencies) : null,
      errorRate: bucket.length ? errored / bucket.length : 0,
    });
  }
  return out;
}

/** Weighted mean of item scores tagged with `stat`; null when nothing is tagged. */
function taggedStat(items: ItemAgg[], stat: Stat): number | null {
  let wsum = 0;
  let wscore = 0;
  for (const it of items) {
    const w = it.statTags[stat];
    if (w && w > 0) {
      wsum += w;
      wscore += w * it.score;
    }
  }
  return wsum > 0 ? wscore / wsum : null;
}

/** Latency → 0–1 speed (1 at ≤1s, 0 at ≥60s, linear between). */
function latencyScore(ms: number | null): number {
  if (ms === null) return 0.5; // unknown → neutral
  return clamp01(1 - (ms - 1000) / (60_000 - 1000));
}

export interface StatResult {
  card: StatCard;
  /** Overall fraction of executions that errored/timed-out. */
  errorRate: number;
  /** How many items back each stat (the confidence signal — more = more stable). */
  samples: Record<Stat, number>;
}

/** Count the items backing each stat (for the confidence/"n=" surface). */
function countSamples(items: ItemAgg[]): Record<Stat, number> {
  const domains = new Set(items.map((i) => i.domain));
  const tagged = (s: Stat) => items.filter((i) => (i.statTags[s] ?? 0) > 0).length;
  return {
    intelligence: tagged("intelligence"),
    wisdom: tagged("wisdom"),
    // Strength/Speed/Fortitude are universal (every item); Dexterity is breadth.
    strength: items.length,
    speed: items.length,
    fortitude: items.length,
    dexterity: domains.size,
  };
}

export function computeStatCard(results: ResultForAgg[]): StatResult {
  const items = aggregateItems(results);
  if (items.length === 0) {
    return {
      card: { strength: 0, dexterity: 0, intelligence: 0, wisdom: 0, fortitude: 0, speed: 0 },
      errorRate: 0,
      samples: { strength: 0, dexterity: 0, intelligence: 0, wisdom: 0, fortitude: 0, speed: 0 },
    };
  }

  const overallMean = mean(items.map((i) => i.score));
  const errorRate = mean(items.map((i) => i.errorRate));

  // Per-domain mean (for breadth/Dexterity + Fortitude's consistency blend).
  const byDomain = new Map<BenchmarkDomain, number[]>();
  for (const it of items) {
    const arr = byDomain.get(it.domain) ?? [];
    arr.push(it.score);
    byDomain.set(it.domain, arr);
  }
  const domainMeans = [...byDomain.entries()].map(([domain, scores]) => ({ domain, mean: mean(scores) }));
  const domainsAbove = domainMeans.filter((d) => d.mean >= 0.5).length;
  const consistency = domainMeans.find((d) => d.domain === "consistency")?.mean ?? null;

  // Content stats (fall back to the overall mean when a suite tags nothing).
  const intelligence = taggedStat(items, "intelligence") ?? overallMean;
  const wisdom = taggedStat(items, "wisdom") ?? overallMean;

  // Strength — gets the job done: correctness × completion.
  const strength = overallMean * (1 - errorRate);

  // Dexterity — versatility across different task types.
  const dexterity = domainMeans.length ? domainsAbove / domainMeans.length : 0;

  // Fortitude — sustains/recovers (completion blended with self-consistency).
  let fortitude = consistency === null ? 1 - errorRate : (1 - errorRate) * 0.6 + consistency * 0.4;

  // ── Trajectory metrics (agentic path only) ──────────────────────
  // Modern agent eval grades the PATH, not just the answer. When the run carried
  // a real tool trajectory, fold those signals into the relevant stats:
  //   • recovery from failed tool calls → Fortitude (diligence)
  //   • tool/argument correctness        → Wisdom (applying ability well)
  // Guarded so brain-only runs (no metrics) are byte-identical to before.
  let wisdomFinal = wisdom;
  const traj = results.map((r) => r.metrics).filter((m): m is ItemMetrics => Boolean(m));
  if (traj.length > 0) {
    const rm = aggregateMetrics(traj);
    if (rm.recoveryRate !== null) fortitude = fortitude * 0.7 + rm.recoveryRate * 0.3;
    if (rm.toolCorrectness !== null) wisdomFinal = wisdomFinal * 0.7 + rm.toolCorrectness * 0.3;
  }

  // Speed — fast start→finish, lightly quality-weighted (fast-but-wrong scores low).
  const meanLatency = (() => {
    const ls = items.map((i) => i.latencyMs).filter((l): l is number => l !== null);
    return ls.length ? mean(ls) : null;
  })();
  const speed = latencyScore(meanLatency) * (0.5 + 0.5 * overallMean);

  // Explicit per-stat tags can still nudge STR/DEX/SPD/FOR upward if a suite uses them.
  const tagged = (s: Stat, base: number) => {
    const t = taggedStat(items, s);
    return t === null ? base : (base + t) / 2;
  };

  return {
    card: {
      strength: pct(tagged("strength", strength)),
      dexterity: pct(tagged("dexterity", dexterity)),
      intelligence: pct(intelligence),
      wisdom: pct(wisdomFinal),
      fortitude: pct(tagged("fortitude", fortitude)),
      speed: pct(tagged("speed", speed)),
    },
    errorRate,
    samples: countSamples(items),
  };
}

/**
 * The five stats that describe CAPABILITY. `speed` is deliberately absent.
 *
 * ADR-0004: a number that describes the Body must not move when you swap the
 * Brain for a faster one. `speed` is `latencyScore(ms)` — pure wall-clock — so
 * blending it into the headline meant a quicker model looked more capable, and
 * the leaderboard ranked on that. Fortitude stays: it is completion-vs-error
 * rate, which is reliability, not haste.
 */
const CAPABILITY_STATS: Stat[] = [
  "strength",
  "dexterity",
  "intelligence",
  "wisdom",
  "fortitude",
];

/**
 * Capability rating from a stat card: the mean of the five capability stats
 * (0–100). This is the headline number and the leaderboard's sort key.
 */
export function capabilityFromStatCard(card: StatCard): number {
  return Math.round(mean(CAPABILITY_STATS.map((s) => card[s])));
}

/**
 * The operational columns, reported ALONGSIDE capability and never folded into
 * it. Speed is the 0–100 latency score already on the card.
 */
export function operationalFromStatCard(card: StatCard): { speed: number } {
  return { speed: card.speed };
}

/**
 * @deprecated Blends latency into capability. Use {@link capabilityFromStatCard}
 * and report {@link operationalFromStatCard} separately. Kept only so a stored
 * historical `overallRating` can still be explained.
 */
export function ratingFromStatCard(card: StatCard): number {
  return Math.round(mean(Object.values(card)));
}

/** Merge several stat cards (e.g. latest run per suite) into one holistic card. */
export function mergeStatCards(cards: StatCard[]): StatCard | null {
  if (cards.length === 0) return null;
  const stats: Stat[] = ["strength", "dexterity", "intelligence", "wisdom", "fortitude", "speed"];
  const out = {} as StatCard;
  for (const s of stats) out[s] = Math.round(mean(cards.map((c) => c[s])));
  return out;
}
