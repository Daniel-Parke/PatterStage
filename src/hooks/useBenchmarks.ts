// ═══════════════════════════════════════════════════════════════
// useBenchmarks — TanStack Query data layer for the Benchmarks page
// ═══════════════════════════════════════════════════════════════

"use client";

import { useApiResource } from "./useApiResource";
import type { BenchmarkRun, BenchmarkItemResult } from "@/lib/benchmarks/types";
import type { SuiteMeta } from "@/lib/benchmarks/suites";
import type { AgentRating } from "@/lib/benchmarks/rating";

export interface LeaderboardEntry {
  rank: number;
  targetRef: string;
  targetLabel: string;
  rating: AgentRating | null;
  ratedAt: string | null;
}

/** Client-safe suite catalogue (no prompts/answers). */
export function useSuites() {
  const r = useApiResource<SuiteMeta[]>(["benchmark-suites"], "/api/benchmarks/suites", {
    select: (p) => (p as { suites?: SuiteMeta[] } | null)?.suites,
    fallback: [],
    errorMessage: "Failed to load suites",
    staleTime: 60_000,
  });
  return { suites: r.data ?? [], isLoading: r.isLoading, error: r.error };
}

/** Recent benchmark runs; polls while any are in flight. */
export function useBenchmarkRuns(limit = 50) {
  const r = useApiResource<BenchmarkRun[]>(["benchmark-runs", limit], `/api/benchmarks/runs?limit=${limit}`, {
    select: (p) => (p as { runs?: BenchmarkRun[] } | null)?.runs,
    fallback: [],
    errorMessage: "Failed to load runs",
    refetchInterval: 4_000,
    staleTime: 2_000,
  });
  return { runs: r.data ?? [], isLoading: r.isLoading, error: r.error, refetch: r.refetch };
}

export interface RunDetail {
  run: BenchmarkRun;
  results: BenchmarkItemResult[];
}

/** One run + its per-item results; polls every 2s (cheap; stops mattering once terminal). */
export function useBenchmarkRun(id: string | null) {
  const r = useApiResource<RunDetail>(
    ["benchmark-run", id ?? "none"],
    id ? `/api/benchmarks/runs/${id}` : "/api/benchmarks/runs/none",
    {
      select: (p) => {
        const d = p as { run?: BenchmarkRun; results?: BenchmarkItemResult[] } | null;
        return d?.run ? { run: d.run, results: d.results ?? [] } : undefined;
      },
      errorMessage: "Failed to load run",
      refetchInterval: id ? 2_000 : false,
    },
  );
  return { detail: id ? r.data : null, isLoading: r.isLoading, error: r.error };
}

/** Local Agent-Rating leaderboard for a suite (defaults to the first suite). */
export function useLeaderboard(suiteKey?: string) {
  const qs = suiteKey ? `?suite=${encodeURIComponent(suiteKey)}` : "";
  const r = useApiResource<LeaderboardEntry[]>(
    ["benchmark-leaderboard", suiteKey ?? "default"],
    `/api/benchmarks/leaderboard${qs}`,
    {
      select: (p) => (p as { entries?: LeaderboardEntry[] } | null)?.entries,
      fallback: [],
      errorMessage: "Failed to load leaderboard",
      refetchInterval: 10_000,
      staleTime: 5_000,
    },
  );
  return { entries: r.data ?? [], isLoading: r.isLoading, error: r.error };
}
