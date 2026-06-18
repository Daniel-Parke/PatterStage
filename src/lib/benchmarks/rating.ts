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

import { latestCompletedRun } from "./benchmarks-repository";
import type { BenchmarkRun, DomainScore } from "./types";

export interface AgentRating {
  /** 0..100 overall rating. */
  rating: number;
  suiteKey: string;
  suiteVersion: string;
  runId: string;
  ratedAt: string | null;
  repeats: number;
  domains: DomainScore[];
  /** Highest-scoring domain (a quick "what is this agent good at?"). */
  bestDomain: DomainScore | null;
  /** Lowest-scoring domain (its weak spot). */
  worstDomain: DomainScore | null;
}

/** Pure: project a completed run's summary into an AgentRating (null if no summary). */
export function ratingFromRun(run: BenchmarkRun): AgentRating | null {
  if (!run.summary) return null;
  const domains = [...run.summary.domains];
  const sorted = [...domains].sort((a, b) => b.score - a.score);
  return {
    rating: run.summary.overallRating,
    suiteKey: run.suiteKey,
    suiteVersion: run.suiteVersion,
    runId: run.id,
    ratedAt: run.completedAt,
    repeats: run.repeats,
    domains,
    bestDomain: sorted[0] ?? null,
    worstDomain: sorted[sorted.length - 1] ?? null,
  };
}

/** The latest Agent Rating for a profile (optionally pinned to a suite). */
export function agentRatingForProfile(profileRef: string, suiteKey?: string): AgentRating | null {
  const run = latestCompletedRun("agent", profileRef, suiteKey);
  return run ? ratingFromRun(run) : null;
}
