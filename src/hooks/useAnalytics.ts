// ═══════════════════════════════════════════════════════════════
// useAnalytics — TanStack Query data layer for the Insights page
//
// Wraps the /api/analytics surface (summary + daily timeseries) over the shared
// safeApiCall fetcher. Both queries throw on error so the page renders
// <LoadErrorBanner/>. 30s cadence (the underlying events are append-only).
// ═══════════════════════════════════════════════════════════════

"use client";

import { useQuery } from "@tanstack/react-query";
import { safeApiCall } from "@/lib/api-fetch";
import type { AnalyticsSummary } from "@/lib/analytics/aggregates";
import type { TimeseriesPoint } from "@/lib/analytics/analytics-repository";
import type { AnalyticsEventType } from "@/lib/analytics/event-types";

async function fetchSummary(): Promise<AnalyticsSummary> {
  const res = await safeApiCall<{ data?: { analytics: AnalyticsSummary } }>("/api/analytics");
  if (!res.ok || !res.data?.data?.analytics) {
    throw new Error(res.error ?? "Failed to load analytics");
  }
  return res.data.data.analytics;
}

export function useAnalytics() {
  const query = useQuery({
    queryKey: ["analytics-summary"],
    queryFn: fetchSummary,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
  return {
    summary: query.data ?? null,
    isLoading: query.isLoading,
    error: query.isError ? (query.error as Error).message : null,
    refetch: () => query.refetch(),
  };
}

async function fetchTimeseries(
  type: AnalyticsEventType | undefined,
  days: number,
): Promise<TimeseriesPoint[]> {
  const qs = new URLSearchParams({ days: String(days) });
  if (type) qs.set("type", type);
  const res = await safeApiCall<{ data?: { timeseries: TimeseriesPoint[] } }>(
    `/api/analytics/timeseries?${qs.toString()}`,
  );
  if (!res.ok) throw new Error(res.error ?? "Failed to load analytics timeseries");
  return res.data?.data?.timeseries ?? [];
}

export function useAnalyticsTimeseries(type?: AnalyticsEventType, days = 30) {
  const query = useQuery({
    queryKey: ["analytics-timeseries", type ?? "all", days],
    queryFn: () => fetchTimeseries(type, days),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
  return {
    points: query.data ?? [],
    isLoading: query.isLoading,
    error: query.isError ? (query.error as Error).message : null,
  };
}
