// ═══════════════════════════════════════════════════════════════
// benchmarks/rating.ts — the Agent Rating axis
//
// The Agent Rating is a SECOND, distinct progression axis from the operator
// engagement layer (XP/level/streaks in stats/derive.ts). Where Operator XP
// measures how much YOU use the platform, the Agent Rating measures how good
// your AGENT is — derived purely from its latest completed benchmark run.
//
// This is what a leaderboard ranks and what a shareable agent card carries.
// ═══════════════════════════════════════════════════════════════

import { latestCompletedRun, listBenchmarkRuns } from "./benchmarks-repository";
import { mergeStatCards, ratingFromStatCard } from "./stats";
import type { BenchmarkRun, DomainScore, Stat, StatCard } from "./types";

export interface AgentRating {
  /** 0..100 overall rating (mean of the stat card). */
  rating: number;
  suiteKey: string;
  suiteVersion: string;
  runId: string;
  ratedAt: string | null;
  repeats: number;
  /** The 6-stat JRPG card (the headline). */
  stats: StatCard | null;
  /** Which brain produced it. */
  modelLabel: string | null;
  /** Augmentation tags. */
  usedSkills: boolean | null;
  usedTools: boolean | null;
  usedMemory: boolean | null;
  domains: DomainScore[];
  /** Strongest stat (a quick "what is this agent good at?"). */
  bestStat: { stat: Stat; value: number } | null;
  /** Weakest stat (its growth area). */
  worstStat: { stat: Stat; value: number } | null;
}

function bestWorstStat(card: StatCard | null): {
  best: { stat: Stat; value: number } | null;
  worst: { stat: Stat; value: number } | null;
} {
  if (!card) return { best: null, worst: null };
  const entries = (Object.entries(card) as [Stat, number][]).map(([stat, value]) => ({ stat, value }));
  const sorted = [...entries].sort((a, b) => b.value - a.value);
  return { best: sorted[0] ?? null, worst: sorted[sorted.length - 1] ?? null };
}

/** Pure: project a completed run's summary into an AgentRating (null if no summary). */
export function ratingFromRun(run: BenchmarkRun): AgentRating | null {
  if (!run.summary) return null;
  const stats = run.summary.stats ?? null;
  const { best, worst } = bestWorstStat(stats);
  return {
    rating: run.summary.overallRating,
    suiteKey: run.suiteKey,
    suiteVersion: run.suiteVersion,
    runId: run.id,
    ratedAt: run.completedAt,
    repeats: run.repeats,
    stats,
    modelLabel: run.modelLabel,
    usedSkills: run.usedSkills,
    usedTools: run.usedTools,
    usedMemory: run.usedMemory,
    domains: [...run.summary.domains],
    bestStat: best,
    worstStat: worst,
  };
}

/** The latest Agent Rating for a profile (optionally pinned to a suite). */
export function agentRatingForProfile(profileRef: string, suiteKey?: string): AgentRating | null {
  const run = latestCompletedRun("agent", profileRef, suiteKey);
  return run ? ratingFromRun(run) : null;
}

export interface HolisticStatCard {
  card: StatCard;
  /** 0..100 overall (mean of the merged stats). */
  rating: number;
  /** How many distinct suites contributed. */
  suites: number;
  bestStat: { stat: Stat; value: number } | null;
  worstStat: { stat: Stat; value: number } | null;
}

/**
 * The agent's HOLISTIC stat card — the realisation of "hundreds of suites → one
 * card". Merges the latest completed run's stat card across every suite the
 * agent has been benchmarked on. This is what a leaderboard / shareable card
 * should rank on (vs a single suite).
 */
export function holisticStatCard(profileRef: string): HolisticStatCard | null {
  const runs = listBenchmarkRuns({ targetKind: "agent", targetRef: profileRef, status: "completed", limit: 500 });
  // runs come newest-first; keep the first (latest) card per suite.
  const latestPerSuite = new Map<string, StatCard>();
  for (const run of runs) {
    if (run.summary?.stats && !latestPerSuite.has(run.suiteKey)) {
      latestPerSuite.set(run.suiteKey, run.summary.stats);
    }
  }
  const merged = mergeStatCards([...latestPerSuite.values()]);
  if (!merged) return null;
  const { best, worst } = bestWorstStat(merged);
  return {
    card: merged,
    rating: ratingFromStatCard(merged),
    suites: latestPerSuite.size,
    bestStat: best,
    worstStat: worst,
  };
}
