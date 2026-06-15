// ═══════════════════════════════════════════════════════════════
// analytics/aggregates.ts — composed read-models for the /api/analytics layer
//
// Keeps the route handlers one-liners. Pure composition over the repository's
// defensive aggregations, so an empty / pre-v12 DB yields a zero-filled summary.
// ═══════════════════════════════════════════════════════════════

import { countByType, countByTypeSince, distinctActiveDays } from "./analytics-repository";

export interface AnalyticsSummary {
  /** Total events per type, all time. */
  totals: Record<string, number>;
  /** Events per type over the last 30 days. */
  last30: Record<string, number>;
  /** Distinct active days in the last 30 days. */
  activeDays: number;
  generatedAt: string;
}

export function getAnalyticsSummary(): AnalyticsSummary {
  return {
    totals: countByType(),
    last30: countByTypeSince(30),
    activeDays: distinctActiveDays(30).length,
    generatedAt: new Date().toISOString(),
  };
}
