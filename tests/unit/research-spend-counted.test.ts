/**
 * @jest-environment node
 *
 * T-0030 acceptance oracle, spend half.
 *
 * The console currently prints Deep Research as "cost not recorded" with a run
 * count, excludes it from every total, and says so in `unmeasured`. Once runs
 * carry token counts, it must price them like the other two sources and drop
 * the exclusion.
 *
 * THE HARD PART IS THE RUNS THAT CAME BEFORE. Every research run that predates
 * migration 034 has NULL token columns. Those must stay excluded and stay
 * declared. Folding them in at zero would take a real, uncounted cost and paint
 * it as free, which is the precise failure the whole task exists to remove,
 * moved one layer down where it is harder to see.
 *
 * So an install with both kinds of run must price the counted ones AND keep
 * saying that the uncounted ones are not in the total.
 */

import type { SpendSummary } from "@/lib/spend/spend-summary";

type ResearchRow = { promptTokens: number | null; completionTokens: number | null; model: string | null };

/** Load spend-summary with the repository reads stubbed. */
async function summaryWith(rows: ResearchRow[], nowIso = "2026-08-26T12:00:00.000Z"): Promise<SpendSummary> {
  jest.resetModules();
  jest.doMock("@/lib/spend/spend-repository", () => ({
    readRunUsageSince: () => [],
    readSpendPolicy: () => ({ limitUsd: null, period: "month", hardStop: false, updatedAt: "" }),
    readResearchUsageSince: () => rows,
  }));
  const mod = await import("@/lib/spend/spend-summary");
  return mod.getSpendSummary(nowIso);
}

function research(summary: SpendSummary) {
  const period = summary.periods.find((p) => p.period === summary.budgetPeriod)!;
  return period.sources.find((s) => s.source === "research")!;
}

afterEach(() => {
  jest.dontMock("@/lib/spend/spend-repository");
  jest.resetModules();
});

describe("Deep Research spend is counted once it is recorded", () => {
  it("prices a run that carries token counts", async () => {
    const summary = await summaryWith([
      { promptTokens: 1000, completionTokens: 500, model: null },
    ]);
    const row = research(summary);
    expect(row.recorded).toBe(true);
    expect(row.inputTokens).toBe(1000);
    expect(row.outputTokens).toBe(500);
    expect(row.costUsd).not.toBeNull();
    expect(row.costUsd!).toBeGreaterThan(0);
  });

  it("adds that cost to the period total the budget is measured against", async () => {
    const summary = await summaryWith([
      { promptTokens: 1000, completionTokens: 500, model: null },
    ]);
    const period = summary.periods.find((p) => p.period === summary.budgetPeriod)!;
    expect(period.totalUsd).toBeGreaterThan(0);
    expect(summary.budgetSpentUsd).toBe(period.totalUsd);
  });

  it("says nothing is unmeasured when every run carries counts", async () => {
    const summary = await summaryWith([
      { promptTokens: 10, completionTokens: 5, model: null },
      { promptTokens: 20, completionTokens: 5, model: null },
    ]);
    expect(summary.unmeasured).toEqual([]);
  });

  it("KEEPS declaring the runs that predate the migration, and does not price them at zero", async () => {
    const summary = await summaryWith([
      { promptTokens: null, completionTokens: null, model: null },
      { promptTokens: null, completionTokens: null, model: null },
    ]);
    expect(summary.unmeasured).toHaveLength(1);
    // The COUNT and the exclusion are what matter; the prose around them is the
    // implementation's to choose. Pinning the sentence would make this a
    // wording test, and the next person to improve the wording would read a red
    // build as a behaviour regression.
    expect(summary.unmeasured[0]).toContain("2");
    expect(summary.unmeasured[0]).toMatch(/Research/i);
    expect(summary.unmeasured[0]).toMatch(/not counted/i);
    // Two uncounted runs must not add up to a confident $0.00 in the source row.
    expect(research(summary).costUsd).toBe(0);
    expect(research(summary).runs).toBe(2);
  });

  it("prices the counted runs and declares the uncounted ones, in the same period", async () => {
    const summary = await summaryWith([
      { promptTokens: 1000, completionTokens: 500, model: null },
      { promptTokens: null, completionTokens: null, model: null },
    ]);
    const row = research(summary);
    expect(row.costUsd!).toBeGreaterThan(0);
    expect(row.inputTokens).toBe(1000);
    expect(summary.unmeasured).toHaveLength(1);
    expect(summary.unmeasured[0]).toContain("1");
    expect(summary.unmeasured[0]).toMatch(/Research/i);
    expect(summary.unmeasured[0]).toMatch(/not counted/i);
  });

  it("counts a genuine zero-token run as counted, not as missing", async () => {
    const summary = await summaryWith([{ promptTokens: 0, completionTokens: 0, model: null }]);
    expect(summary.unmeasured).toEqual([]);
  });

  // ── no-regression guards ──

  it("still reports every source in a stable order", async () => {
    const summary = await summaryWith([]);
    const period = summary.periods.find((p) => p.period === summary.budgetPeriod)!;
    // `story` is fourth and last, added by T-0108; the first three keep their
    // order, which is the part this guard is about.
    expect(period.sources.map((s) => s.source)).toEqual(["agent", "composer", "research", "story"]);
  });

  it("still says nothing is unmeasured on an install with no research at all", async () => {
    const summary = await summaryWith([]);
    expect(summary.unmeasured).toEqual([]);
  });
});
