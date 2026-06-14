// ═══════════════════════════════════════════════════════════════
// useStats — TanStack Query data layer for the command-center dashboard
// ═══════════════════════════════════════════════════════════════

"use client";

import { useQuery } from "@tanstack/react-query";
import { safeApiCall } from "@/lib/api-fetch";
import type { DashboardStats } from "@/lib/stats/stats-repository";

async function fetchStats(): Promise<DashboardStats> {
  const res = await safeApiCall<{ data?: { stats: DashboardStats } }>("/api/stats");
  if (!res.ok || !res.data?.data?.stats) {
    throw new Error(res.error ?? "Failed to load stats");
  }
  return res.data.data.stats;
}

/** Polls the dashboard stats on a 20s cadence (live-ish without SSE pressure). */
export function useStats() {
  const query = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: fetchStats,
    refetchInterval: 20_000,
    staleTime: 10_000,
  });
  return {
    stats: query.data ?? null,
    isLoading: query.isLoading,
    error: query.isError ? (query.error as Error).message : null,
    refetch: () => query.refetch(),
  };
}

export type { DashboardStats };
