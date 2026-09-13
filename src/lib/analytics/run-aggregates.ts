// ═══════════════════════════════════════════════════════════════
// analytics/run-aggregates.ts — deeper run analytics mined from EXISTING
// data (runs + missions). No schema change: durations come from run
// timestamps, model dimension from the linked mission, cost from model-cost.
// Reads are defensive (try/catch → empty) like the other repos.
// ═══════════════════════════════════════════════════════════════

import {
  readCompletedRunCountsByMission,
  readCompletedRunTimings,
  readCompletedRunUsageByMission,
  readRunUsageByModel,
} from "./analytics-repository";
import { estimateCost } from "./model-cost";
import type { HistogramBin } from "@/components/viz/DistributionHistogram";

function safeRead<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function days(n: number): string {
  return `-${Math.max(0, Math.floor(n))} days`;
}

// ── Run-duration distribution ────────────────────────────────

const DURATION_BUCKETS: Array<{ label: string; max: number }> = [
  { label: "<5s", max: 5 },
  { label: "5–15s", max: 15 },
  { label: "15–30s", max: 30 },
  { label: "30–60s", max: 60 },
  { label: "1–2m", max: 120 },
  { label: "2–5m", max: 300 },
  { label: "5m+", max: Infinity },
];

/** Bucket a set of run durations (seconds) into the histogram bins. Pure. */
export function bucketDurations(durationsSec: number[]): HistogramBin[] {
  const counts = DURATION_BUCKETS.map(() => 0);
  for (const d of durationsSec) {
    if (!Number.isFinite(d) || d < 0) continue;
    const idx = DURATION_BUCKETS.findIndex((b) => d < b.max);
    counts[idx >= 0 ? idx : DURATION_BUCKETS.length - 1] += 1;
  }
  return DURATION_BUCKETS.map((b, i) => ({ label: b.label, value: counts[i] }));
}

/** Run-duration histogram for completed runs in the window. */
export function getRunDurationBuckets(sinceDays = 90): HistogramBin[] {
  return safeRead(() => {
    const rows = readCompletedRunTimings(days(sinceDays));
    const durations = rows.map(
      // submitted_at/completed_at are ISO-8601 with a 'Z' (now() = toISOString());
      // appending another 'Z' made Date.parse return NaN → an all-zero histogram.
      (r) => (Date.parse(r.completed_at) - Date.parse(r.submitted_at)) / 1000,
    );
    return bucketDurations(durations);
  }, bucketDurations([]));
}

// ── Per-model token usage + estimated cost ───────────────────

export interface ModelUsageRow {
  model: string;
  provider: string | null;
  runs: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
}

/**
 * Per-model token totals + estimated spend, from runs joined to their mission
 * (the model dimension lives on the mission). Chat runs without a mission are
 * excluded; mission runs are the bulk.
 */
export function getModelUsage(sinceDays = 90): ModelUsageRow[] {
  return safeRead(() => {
    const rows = readRunUsageByModel(days(sinceDays));

    const byModel = new Map<string, ModelUsageRow>();
    for (const r of rows) {
      const model = r.model || "unknown";
      let input = 0;
      let output = 0;
      let total = 0;
      try {
        const u = JSON.parse(r.usage) as { inputTokens?: number; outputTokens?: number; totalTokens?: number };
        input = Number(u.inputTokens ?? 0);
        output = Number(u.outputTokens ?? 0);
        total = Number(u.totalTokens ?? input + output);
      } catch {
        continue;
      }
      const agg = byModel.get(model) ?? {
        model,
        provider: r.provider,
        runs: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        costUsd: 0,
      };
      agg.runs += 1;
      agg.inputTokens += input;
      agg.outputTokens += output;
      agg.totalTokens += total;
      agg.costUsd += estimateCost(model, input, output);
      byModel.set(model, agg);
    }
    return [...byModel.values()].sort((a, b) => b.totalTokens - a.totalTokens);
  }, []);
}

// ── Top missions by completed runs ───────────────────────────

export interface TopMissionRow {
  missionId: string;
  name: string;
  runs: number;
  totalTokens: number;
}

/** Most-run missions in the window (by completed runs), with token totals. */
export function getTopMissions(limit = 6, sinceDays = 90): TopMissionRow[] {
  return safeRead(() => {
    const rows = readCompletedRunCountsByMission(days(sinceDays));
    // token totals need a second pass (GROUP BY can't sum parsed JSON)
    const tokenRows = readCompletedRunUsageByMission(days(sinceDays));
    const tokensByMission = new Map<string, number>();
    for (const t of tokenRows) {
      try {
        const u = JSON.parse(t.usage) as { totalTokens?: number };
        tokensByMission.set(t.id, (tokensByMission.get(t.id) ?? 0) + Number(u.totalTokens ?? 0));
      } catch {
        /* skip */
      }
    }
    return rows
      .map((r) => ({
        missionId: r.id,
        name: r.name,
        runs: r.runs,
        totalTokens: tokensByMission.get(r.id) ?? 0,
      }))
      .sort((a, b) => b.runs - a.runs || b.totalTokens - a.totalTokens)
      .slice(0, Math.max(1, Math.floor(limit)));
  }, []);
}
