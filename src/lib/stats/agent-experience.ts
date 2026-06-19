// ═══════════════════════════════════════════════════════════════
// stats/agent-experience.ts — the Agent Experience Level (a 3rd axis)
//
// Distinct from Operator XP (how much the USER operates, derive.ts) and the
// Agent Stat Card (capability from benchmarks). Experience measures how much an
// AGENT has GROWN from being run — its accumulated activity plus its expanding
// footprint of skills, tools and memory. Reuses the operator level-curve
// machinery (computeLevel) so the badge/ring components work unchanged, but is
// fed entirely by per-agent signals and carries its own title set.
//
// The pure functions (computeAgentXp / computeAgentLevel) have no IO and are
// unit-tested; agentExperienceForProfile reads the per-agent signals.
// ═══════════════════════════════════════════════════════════════

import { db } from "@/lib/db";
import { computeLevel, type LevelInfo } from "./derive";
import { getAgentPerformance } from "./agent-stats";

/** Per-agent signals that accrue Experience. */
export interface AgentExperienceSignals {
  /** Runs the agent has completed (the core "it has been run" signal). */
  runsCompleted: number;
  /** Tokens it has processed. */
  totalTokens: number;
  /** Distinct days it was active. */
  activeDays: number;
  /** Enabled skills (capability footprint). */
  skillsEnabled: number;
  /** Platform toolsets attached. */
  toolsetCount: number;
  /** Semantic-memory facts grown (0 when the provider count is unavailable). */
  memoryFacts: number;
  /** Benchmarks completed (a minor input — capability is the stat card's job). */
  benchmarksCompleted: number;
}

/** XP weights — usage + footprint dominate; benchmarks are a small bonus. */
export const AGENT_XP = {
  perRun: 40,
  perThousandTokens: 0.5,
  perActiveDay: 60,
  perSkill: 80,
  perToolset: 50,
  perMemoryFact: 5,
  perBenchmark: 30,
} as const;

export function computeAgentXp(s: AgentExperienceSignals): number {
  return Math.round(
    s.runsCompleted * AGENT_XP.perRun +
      (s.totalTokens / 1000) * AGENT_XP.perThousandTokens +
      s.activeDays * AGENT_XP.perActiveDay +
      s.skillsEnabled * AGENT_XP.perSkill +
      s.toolsetCount * AGENT_XP.perToolset +
      s.memoryFacts * AGENT_XP.perMemoryFact +
      s.benchmarksCompleted * AGENT_XP.perBenchmark,
  );
}

/** Growth-flavoured titles (parallel to the operator set, distinct vocabulary). */
const AGENT_TITLES = [
  "Hatchling",
  "Apprentice",
  "Adept",
  "Specialist",
  "Operative",
  "Veteran",
  "Expert",
  "Master",
  "Grandmaster",
  "Ascendant",
] as const;

/** Reuse the operator level curve, but with agent-growth titles. */
export function computeAgentLevel(xp: number): LevelInfo {
  const info = computeLevel(xp);
  return { ...info, title: AGENT_TITLES[Math.min(info.level - 1, AGENT_TITLES.length - 1)] };
}

export interface AgentExperience {
  slug: string;
  level: LevelInfo;
  xp: number;
  signals: AgentExperienceSignals;
}

function scalar(sql: string, ...params: unknown[]): number {
  try {
    const row = db().prepare(sql).get(...params) as { v: number } | undefined;
    const n = Number(row?.v);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

/** Resolve the Experience level for one agent profile from its signals. */
export function agentExperienceForProfile(slug: string): AgentExperience | null {
  const perf = getAgentPerformance().find((p) => p.slug === slug);
  if (!perf) return null;

  const activeDays = scalar(
    "SELECT COUNT(DISTINCT date(completed_at)) AS v FROM runs WHERE profile_name = ? AND status = 'completed'",
    slug,
  );
  const benchmarksCompleted = scalar(
    "SELECT COUNT(*) AS v FROM benchmark_runs WHERE target_ref = ? AND status = 'completed'",
    slug,
  );

  const signals: AgentExperienceSignals = {
    runsCompleted: perf.runs,
    totalTokens: perf.totalTokens,
    activeDays,
    skillsEnabled: perf.skills,
    toolsetCount: perf.toolsets,
    memoryFacts: 0, // provider-side; surfaced when a count API lands (BB6)
    benchmarksCompleted,
  };
  const xp = computeAgentXp(signals);
  return { slug, level: computeAgentLevel(xp), xp, signals };
}
