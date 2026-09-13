// ═══════════════════════════════════════════════════════════════
// analytics/insights-bundle.ts — composed read-model for the Insights
// workbench (/api/analytics/insights?days=N). Pure composition over the
// repository + run aggregates, so an empty DB yields a zero-filled bundle.
// ═══════════════════════════════════════════════════════════════

import {
  countByHourAllTypes,
  dailyCountsByType,
  distinctActiveDays,
} from "./analytics-repository";
import {
  getRunDurationBuckets,
  getModelUsage,
  getTopMissions,
  type ModelUsageRow,
  type TopMissionRow,
} from "./run-aggregates";
import { EVENT_CATEGORIES, categoryForEventType } from "./categories";
import type { HistogramBin } from "@/components/viz/DistributionHistogram";
import type { StackedPoint, StackedSeries } from "@/components/viz/StackedAreaTrend";
import type { AreaPoint } from "@/components/viz/AreaTrend";

export interface InsightsBundle {
  days: number;
  /** Distinct days with any event inside this window (the Active days tile, T-0099 D96). */
  activeDays: number;
  /** 24-length all-events hour-of-day histogram. */
  hourOfDay: number[];
  /** Per-category daily counts (stacked-area input). */
  categorySeries: StackedSeries[];
  categoryDaily: StackedPoint[];
  /** Run-duration distribution. */
  durationBuckets: HistogramBin[];
  /** Per-model token totals + estimated spend. */
  modelUsage: ModelUsageRow[];
  /** Most-run missions. */
  topMissions: TopMissionRow[];
  /** Mission completed-vs-failed per day. */
  successTrend: AreaPoint[];
  generatedAt: string;
}

export function getInsightsBundle(days: number): InsightsBundle {
  const n = Math.max(1, Math.min(365, Math.floor(days)));
  const daily = dailyCountsByType(n);

  const categorySeries: StackedSeries[] = EVENT_CATEGORIES.map((c) => ({
    key: c.key,
    label: c.label,
    color: c.color,
  }));

  const categoryDaily: StackedPoint[] = daily.map((d) => {
    const values: Record<string, number> = {};
    for (const c of EVENT_CATEGORIES) values[c.key] = 0;
    for (const [type, count] of Object.entries(d.counts)) {
      const cat = categoryForEventType(type);
      if (cat) values[cat.key] += count;
    }
    return { date: d.date, values };
  });

  const successTrend: AreaPoint[] = daily.map((d) => ({
    date: d.date,
    completed: d.counts["mission.completed"] ?? 0,
    failed: d.counts["mission.failed"] ?? 0,
  }));

  return {
    days: n,
    activeDays: distinctActiveDays(n).length,
    hourOfDay: countByHourAllTypes(n),
    categorySeries,
    categoryDaily,
    durationBuckets: getRunDurationBuckets(n),
    modelUsage: getModelUsage(n),
    topMissions: getTopMissions(6, n),
    successTrend,
    generatedAt: new Date().toISOString(),
  };
}
