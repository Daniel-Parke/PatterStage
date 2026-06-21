// ═══════════════════════════════════════════════════════════════
// useAgentCard — the redacted agent-card (rating + holistic stat card)
// for one profile. Thin wrapper over useApiResource so AgentBenchmarkPanel
// stops hand-rolling fetch/loading/error state in a useEffect.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useApiResource } from "./useApiResource";
import type { StatCard } from "@/lib/benchmarks/types";

export interface AgentCardHolistic {
  card: StatCard;
  rating: number;
  suites: number;
  bestStat?: { stat: string; value: number } | null;
}

export interface AgentCard {
  agentRating: { rating: number; bestStat?: { stat: string } | null } | null;
  holistic: AgentCardHolistic | null;
  experience: { level: number; title: string; xp: number } | null;
}

export function useAgentCard(profileId: string) {
  return useApiResource<AgentCard>(
    ["agent-card", profileId],
    `/api/benchmarks/agent-card?profile=${encodeURIComponent(profileId)}`,
    {
      select: (payload) => (payload as { card?: AgentCard } | undefined)?.card,
      errorMessage: "Failed to load agent card",
    },
  );
}
