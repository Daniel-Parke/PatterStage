/** @jest-environment node */
// Pure trajectory metrics (benchmarks/metrics.ts) — the agent-eval signal set.

import {
  newTrajectory,
  accumulateRunEvent,
  finalizeItemMetrics,
  aggregateMetrics,
  type ItemMetrics,
} from "@/lib/runtime/run-trajectory";

describe("benchmarks/metrics — trajectory accumulation", () => {
  it("counts tool invocations, completions, failures and distinct tools", () => {
    const t = newTrajectory();
    accumulateRunEvent(t, "tool.requested", { name: "web_search" });
    accumulateRunEvent(t, "tool.completed", { name: "web_search" });
    accumulateRunEvent(t, "tool.requested", { name: "calculator" });
    accumulateRunEvent(t, "tool.completed", { name: "calculator" });
    accumulateRunEvent(t, "reasoning.delta", { reasoning: "thinking" });

    const m = finalizeItemMetrics(t, { latencyMs: 1200, completed: true, errored: false });
    expect(m.toolInvocations).toBe(2);
    expect(m.toolCompleted).toBe(2);
    expect(m.toolFailed).toBe(0);
    expect(m.distinctTools.sort()).toEqual(["calculator", "web_search"]);
    expect(m.reasoningSteps).toBe(1);
    expect(m.steps).toBe(3); // 2 invocations + 1 reasoning
  });

  it("detects recovery: a success following a failed call of the same tool", () => {
    const t = newTrajectory();
    accumulateRunEvent(t, "tool.requested", { name: "web_search" });
    accumulateRunEvent(t, "tool.failed", { name: "web_search" });
    accumulateRunEvent(t, "tool.requested", { name: "web_search" });
    accumulateRunEvent(t, "tool.completed", { name: "web_search" });

    const m = finalizeItemMetrics(t, { latencyMs: 800, completed: true, errored: false });
    expect(m.toolFailed).toBe(1);
    expect(m.toolRecoveries).toBe(1);
    expect(m.distinctTools).toEqual(["web_search"]); // distinct, despite 2 invocations
    expect(m.toolInvocations).toBe(2);
  });

  it("a brain-only item (no tool events) yields empty distinctTools — proves a toggle OFF", () => {
    const t = newTrajectory();
    accumulateRunEvent(t, "message.delta", { delta: "hello" });
    accumulateRunEvent(t, "run.completed", { output: "hello" });

    const m = finalizeItemMetrics(t, { latencyMs: 400, completed: true, errored: false });
    expect(m.toolInvocations).toBe(0);
    expect(m.distinctTools).toEqual([]);
  });

  it("ignores unknown/irrelevant event names", () => {
    const t = newTrajectory();
    accumulateRunEvent(t, "open", {});
    accumulateRunEvent(t, "heartbeat", {});
    const m = finalizeItemMetrics(t, { completed: false, errored: true });
    expect(m.steps).toBe(0);
    expect(m.latencyMs).toBeNull();
  });
});

describe("benchmarks/metrics — run aggregation", () => {
  const mk = (over: Partial<ItemMetrics>): ItemMetrics => ({
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

  it("rolls up completion, tool correctness, recovery rate and distinct tools", () => {
    const items: ItemMetrics[] = [
      mk({ toolInvocations: 1, toolCompleted: 1, distinctTools: ["a"], steps: 2, latencyMs: 1000, completed: true }),
      mk({ toolInvocations: 2, toolCompleted: 1, toolFailed: 1, toolRecoveries: 1, distinctTools: ["a", "b"], steps: 4, latencyMs: 2000, completed: true }),
      mk({ completed: false, errored: true, steps: 0 }),
    ];
    const agg = aggregateMetrics(items);
    expect(agg.items).toBe(3);
    expect(agg.completionRate).toBeCloseTo(2 / 3, 5);
    expect(agg.toolInvocations).toBe(3);
    expect(agg.toolCorrectness).toBeCloseTo(2 / 3, 5); // 2 completed / (2 completed + 1 failed)
    expect(agg.recoveryRate).toBe(1); // 1 recovery / 1 failure
    expect(agg.distinctTools.sort()).toEqual(["a", "b"]);
    expect(agg.meanLatencyMs).toBe(1500);
  });

  it("handles an empty run safely", () => {
    const agg = aggregateMetrics([]);
    expect(agg.items).toBe(0);
    expect(agg.toolCorrectness).toBeNull();
    expect(agg.recoveryRate).toBeNull();
    expect(agg.meanLatencyMs).toBeNull();
  });
});
