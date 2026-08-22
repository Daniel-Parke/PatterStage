"use client";

// ═══════════════════════════════════════════════════════════════
// useAgentExperience — the agents ranked by accumulated growth
//
// Replaces useLeaderboard from useBenchmarks, which read
// /api/benchmarks/leaderboard. That endpoint ranked agents by a benchmark rating
// and carried the experience level along as a passenger; only the passenger
// survives (org/decisions/ADR-0004).
// ═══════════════════════════════════════════════════════════════

import { useApiResource } from "./useApiResource";

export interface AgentExperienceEntry {
  rank: number;
  targetRef: string;
  targetLabel: string;
  experience: {
    slug: string;
    xp: number;
    level: { level: number; title: string; progress: number };
    signals: {
      runsCompleted: number;
      totalTokens: number;
      activeDays: number;
      skillsEnabled: number;
      toolsetCount: number;
      memoryFacts: number;
    };
  };
}

/** Agents ranked most-grown first. Empty until an agent has completed work. */
export function useAgentExperience() {
  const { data, ...rest } = useApiResource<AgentExperienceEntry[]>(
    ["agent-experience"],
    "/api/agents/experience",
    {
      select: (payload) => (payload as { entries?: AgentExperienceEntry[] } | undefined)?.entries,
      fallback: [],
    },
  );
  return { entries: data ?? [], ...rest };
}
