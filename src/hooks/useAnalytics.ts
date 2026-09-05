// ═══════════════════════════════════════════════════════════════
// useAnalytics — TanStack Query data layer for the Insights page
//
// Wraps the /api/analytics surface (summary + daily timeseries) on a 30s
// cadence. Both queries throw on error so the page renders <LoadErrorBanner/>.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useApiResource } from "./useApiResource";
import type { AnalyticsSummary } from "@/lib/analytics/aggregates";
import type { InsightsBundle } from "@/lib/analytics/insights-bundle";
import type { TimeseriesPoint } from "@/lib/analytics/analytics-repository";
import type { AnalyticsEventType } from "@/lib/analytics/event-types";

export function useAnalytics() {
  const r = useApiResource<AnalyticsSummary>(["analytics-summary"], "/api/analytics", {
    select: (p) => (p as { analytics?: AnalyticsSummary } | null)?.analytics,
    errorMessage: "Failed to load analytics",
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
  return { summary: r.data, isLoading: r.isLoading, error: r.error, refetch: r.refetch };
}

export function useAnalyticsTimeseries(type?: AnalyticsEventType, days = 30) {
  const qs = new URLSearchParams({ days: String(days) });
  if (type) qs.set("type", type);
  const r = useApiResource<TimeseriesPoint[]>(
    ["analytics-timeseries", type ?? "all", days],
    `/api/analytics/timeseries?${qs}`,
    {
      select: (p) => (p as { timeseries?: TimeseriesPoint[] } | null)?.timeseries,
      errorMessage: "Failed to load analytics timeseries",
      refetchInterval: 30_000,
      staleTime: 15_000,
    },
  );
  return { points: r.data ?? [], isLoading: r.isLoading, error: r.error, refetch: r.refetch };
}

/** The composed Insights workbench bundle for a time window (days). */
export function useInsights(days = 30) {
  const r = useApiResource<InsightsBundle>(
    ["analytics-insights", days],
    `/api/analytics/insights?days=${days}`,
    {
      select: (p) => (p as { insights?: InsightsBundle } | null)?.insights,
      errorMessage: "Failed to load insights",
      refetchInterval: 30_000,
      staleTime: 15_000,
    },
  );
  return { insights: r.data, isLoading: r.isLoading, error: r.error, refetch: r.refetch };
}
