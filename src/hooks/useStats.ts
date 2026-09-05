// ═══════════════════════════════════════════════════════════════
// useStats — TanStack Query data layer for the command-center dashboard
// ═══════════════════════════════════════════════════════════════

"use client";

import { useApiResource } from "./useApiResource";
import type { DashboardStats } from "@/lib/stats/stats-repository";

/** Polls the dashboard stats on a 20s cadence (live-ish without SSE pressure). */
export function useStats() {
  const r = useApiResource<DashboardStats>(["dashboard-stats"], "/api/stats", {
    select: (p) => (p as { stats?: DashboardStats } | null)?.stats,
    errorMessage: "Failed to load stats",
    refetchInterval: 20_000,
    staleTime: 10_000,
  });
  return { stats: r.data, isLoading: r.isLoading, error: r.error, refetch: r.refetch };
}

export type { DashboardStats };
