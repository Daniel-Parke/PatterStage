// ═══════════════════════════════════════════════════════════════
// stats/agent-experience.ts — the Agent Experience Level (a 3rd axis)
//
// Distinct from Operator XP (how much the USER operates, derive.ts). Experience
// measures how much an
// AGENT has GROWN from being run — its accumulated activity plus its expanding
// footprint of skills, tools and memory. Reuses the operator level-curve
// machinery (computeLevel) so the badge/ring components work unchanged, but is
// fed entirely by per-agent signals and carries its own title set.
//
// The pure functions (computeAgentXp / computeAgentLevel) have no IO and are
// unit-tested; agentExperienceForProfile reads the per-agent signals.
// ═══════════════════════════════════════════════════════════════

import { computeLevel, type LevelInfo } from "./derive";
import { countAgentActiveDays } from "./agent-stats-repository";
import type { AgentPerformance } from "./agent-stats";

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
}

/**
 * XP weights: usage + footprint. `perBenchmark: 30` was removed with the
 * benchmark subsystem (org/decisions/ADR-0004). It read benchmark_runs through scalar(),
 * which try/catches to 0, so leaving it would have kept every Agent Level
 * computing with a silently missing term.
 */
export const AGENT_XP = {
  perRun: 40,
  perThousandTokens: 0.5,
  perActiveDay: 60,
  perSkill: 80,
  perToolset: 50,
  perMemoryFact: 5,
} as const;

export function computeAgentXp(s: AgentExperienceSignals): number {
  return Math.round(
    s.runsCompleted * AGENT_XP.perRun +
      (s.totalTokens / 1000) * AGENT_XP.perThousandTokens +
      s.activeDays * AGENT_XP.perActiveDay +
      s.skillsEnabled * AGENT_XP.perSkill +
      s.toolsetCount * AGENT_XP.perToolset +
      s.memoryFacts * AGENT_XP.perMemoryFact,
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

/** Run a repository count read, degrading to 0 exactly as the old inline `scalar` did. */
function safeCount(read: () => number | undefined): number {
  try {
    const n = Number(read());
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

/**
 * Resolve the Experience level from an already-measured performance row.
 *
 * Split out of `agentExperienceForProfile` so a caller that has already paid for
 * `getAgentPerformance()` does not pay for it again per profile. The progression
 * snapshot (`agent-progression.ts`) is that caller: it records the answer the
 * dashboard aggregate just computed, and re-deriving it from scratch would mean
 * a full scan of `runs` per agent on every capture.
 *
 * The derivation is byte-identical to the one that used to be inline below, so
 * both entry points give the same answer for the same profile.
 */
export function agentExperienceFromPerformance(perf: AgentPerformance): AgentExperience {
  const activeDays = safeCount(() => countAgentActiveDays(perf.slug));

  const signals: AgentExperienceSignals = {
    runsCompleted: perf.runsCompleted,
    totalTokens: perf.totalTokens,
    activeDays,
    skillsEnabled: perf.skills,
    toolsetCount: perf.toolsets,
    memoryFacts: 0, // provider-side; surfaced when a count API lands (BB6)
  };
  const xp = computeAgentXp(signals);
  return { slug: perf.slug, level: computeAgentLevel(xp), xp, signals };
}

// `agentExperienceForProfile(slug)` was here, and it was the reason the
// experience board listed profiles only: it took a slug, so its caller had to
// produce a list of slugs, and the list it reached for excluded the root agent
// (T-0081, RC-D). The route now maps getAgentPerformance() -- which has always
// included the root -- straight through agentExperienceFromPerformance, so no
// caller has to know the population in advance. Nothing else used the slug form.
