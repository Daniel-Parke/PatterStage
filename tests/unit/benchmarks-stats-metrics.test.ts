/** @jest-environment node */
// BD3: trajectory metrics fold into the stat card (recovery → Fortitude,
// tool-correctness → Wisdom) WITHOUT disturbing brain-only runs.

import { computeStatCard } from "@/lib/benchmarks/stats";
import type { ResultForAgg } from "@/lib/benchmarks/score";
import type { ItemMetrics } from "@/lib/benchmarks/metrics";

const baseMetrics = (over: Partial<ItemMetrics>): ItemMetrics => ({
  toolInvocations: 0,
  toolCompleted: 0,
  toolFailed: 0,
  toolRecoveries: 0,
  distinctTools: [],
  reasoningSteps: 0,
  steps: 0,
  latencyMs: null,
  completed: true,
  errored: false,
  ...over,
});

const item = (over: Partial<ResultForAgg>): ResultForAgg => ({
  domain: "reasoning",
  itemId: "i1",
  score: 0.8,
  canonical: null,
  statTags: { wisdom: 1 },
  latencyMs: 1500,
  errored: false,
  ...over,
});

describe("benchmarks/stats — metrics blend", () => {
  it("brain-only results (no metrics) are unchanged by the blend", () => {
    const noMetrics = computeStatCard([item({ itemId: "a" }), item({ itemId: "b" })]);
    const nullMetrics = computeStatCard([
      item({ itemId: "a", metrics: null }),
      item({ itemId: "b", metrics: null }),
    ]);
    expect(nullMetrics.card).toEqual(noMetrics.card);
  });

  it("recovery from failed tool calls raises Fortitude", () => {
    const noRecovery = computeStatCard([
      item({ itemId: "a", metrics: baseMetrics({ toolInvocations: 2, toolFailed: 2 }) }),
    ]);
    const recovered = computeStatCard([
      item({
        itemId: "a",
        metrics: baseMetrics({ toolInvocations: 2, toolFailed: 1, toolCompleted: 1, toolRecoveries: 1 }),
      }),
    ]);
    expect(recovered.card.fortitude).toBeGreaterThan(noRecovery.card.fortitude);
  });

  it("high tool correctness raises Wisdom over low correctness", () => {
    const lowCorrect = computeStatCard([
      item({ itemId: "a", metrics: baseMetrics({ toolInvocations: 3, toolCompleted: 1, toolFailed: 2 }) }),
    ]);
    const highCorrect = computeStatCard([
      item({ itemId: "a", metrics: baseMetrics({ toolInvocations: 3, toolCompleted: 3, toolFailed: 0 }) }),
    ]);
    expect(highCorrect.card.wisdom).toBeGreaterThan(lowCorrect.card.wisdom);
  });
});
