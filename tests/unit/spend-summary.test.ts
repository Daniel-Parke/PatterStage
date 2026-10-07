/** @jest-environment node */
// ORACLE for T-0021 (WO-0014), part 2 of 4: the read-model the console draws.
//
// Clause 1: spend is VISIBLE by default, run-aggregate, per period and per
// source, computed from what is already recorded rather than from new tracking.
//
// The clause under the clause is honesty. Deep Research persists no token usage
// anywhere in this database (research_runs has query/status/provider/model_id/
// report and nothing else), so its spend is NOT recoverable from recorded data.
// A summary that quietly folded it in as zero would understate the operator's
// bill and, worse, would make the hard stop under-count by an amount nobody
// could see. So the research row reports `recorded: false` and a null cost, and
// the summary carries the exclusion in `unmeasured` where the UI must show it.

import type { ResearchUsageRow, SpendUsageRow } from "@/lib/spend/spend-repository";

const readRunUsageSince = jest.fn<SpendUsageRow[], [string]>();
const readResearchUsageSince = jest.fn<ResearchUsageRow[], [string]>();
const readSpendPolicy = jest.fn();

jest.mock("@/lib/spend/spend-repository", () => ({
  readRunUsageSince: (since: string) => readRunUsageSince(since),
  readResearchUsageSince: (since: string) => readResearchUsageSince(since),
  readSpendPolicy: () => readSpendPolicy(),
  writeSpendPolicy: jest.fn(),
}));

/** N research runs whose usage was never recorded (every run before 034). */
const unrecordedRuns = (n: number): ResearchUsageRow[] =>
  Array.from({ length: n }, () => ({ promptTokens: null, completionTokens: null, model: null }));

import { getSpendSummary } from "@/lib/spend/spend-summary";
import { UNSET_SPEND_POLICY } from "@/lib/spend/spend-law";

const NOW = "2026-08-23T14:00:00.000Z";

/** 1M input + 1M output on claude-sonnet = 3 + 15 = 18 USD (analytics/model-cost). */
function sonnetRun(source: "agent" | "composer"): SpendUsageRow {
  return {
    source,
    model: "anthropic/claude-sonnet-4",
    usage: JSON.stringify({ inputTokens: 1_000_000, outputTokens: 1_000_000, totalTokens: 2_000_000 }),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  readSpendPolicy.mockReturnValue({ ...UNSET_SPEND_POLICY });
  readRunUsageSince.mockReturnValue([]);
  readResearchUsageSince.mockReturnValue([]);
});

describe("getSpendSummary: clause 1, per period and per source", () => {
  it("reports all three periods so the console can show spend without a round trip", () => {
    const s = getSpendSummary(NOW);
    expect(s.periods.map((p) => p.period)).toEqual(["day", "week", "month"]);
    for (const p of s.periods) {
      expect(p.since).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
      expect(p.sources.map((r) => r.source)).toEqual(["agent", "composer", "research", "story"]);
    }
  });

  it("splits agent runs from Composer stages and totals only what is recorded", () => {
    readRunUsageSince.mockReturnValue([sonnetRun("agent"), sonnetRun("agent"), sonnetRun("composer")]);
    readResearchUsageSince.mockReturnValue(unrecordedRuns(4));

    const month = getSpendSummary(NOW).periods.find((p) => p.period === "month");
    const agent = month?.sources.find((r) => r.source === "agent");
    const composer = month?.sources.find((r) => r.source === "composer");

    expect(agent?.runs).toBe(2);
    expect(agent?.costUsd).toBeCloseTo(36, 6);
    expect(composer?.runs).toBe(1);
    expect(composer?.costUsd).toBeCloseTo(18, 6);
    expect(month?.totalUsd).toBeCloseTo(54, 6);
  });

  it("counts a run with unparseable usage JSON as no spend rather than throwing", () => {
    readRunUsageSince.mockReturnValue([
      { source: "agent", model: "gpt-4o", usage: "not json" },
      sonnetRun("agent"),
    ]);
    const month = getSpendSummary(NOW).periods.find((p) => p.period === "month");
    expect(month?.totalUsd).toBeCloseTo(18, 6);
  });

  // A Composer stage run has no mission, so it has no model dimension either.
  // model-cost's DEFAULT_RATE (1 / 3 USD per 1M) is deliberately used rather
  // than zero: an unknown model must never read as free.
  it("prices a run with no known model at the conservative default rather than zero", () => {
    readRunUsageSince.mockReturnValue([
      {
        source: "composer",
        model: null,
        usage: JSON.stringify({ inputTokens: 1_000_000, outputTokens: 1_000_000 }),
      },
    ]);
    const month = getSpendSummary(NOW).periods.find((p) => p.period === "month");
    expect(month?.totalUsd).toBeCloseTo(4, 6);
  });
});

describe("getSpendSummary: what is NOT recorded is said out loud", () => {
  // These two assertions used to read the other way round, and they were RIGHT
  // to: before migration 034 Deep Research recorded no tokens at all, so the
  // source was unrecorded by construction and `costUsd` was null to keep a
  // genuine unknown from rendering as a confident $0.00.
  //
  // T-0030 made research runs record their usage, so the source is now recorded
  // like the other two. The old expectation is corrected IN PLACE rather than
  // deleted, because the FACT it was protecting has not gone away: a run whose
  // usage was never recorded still must not be priced at zero. That fact now
  // lives on `unmeasured` and in the run count, which is what these assert.
  it("prices a research run that recorded its usage", () => {
    readResearchUsageSince.mockReturnValue([
      { promptTokens: 1000, completionTokens: 500, model: null },
    ]);
    const month = getSpendSummary(NOW).periods.find((p) => p.period === "month");
    const research = month?.sources.find((r) => r.source === "research");
    // Narrowed rather than asserted through the optional chain: `?.x!` tells the
    // compiler to trust a value the expression itself says may be absent, and a
    // missing row would then fail on the WRONG assertion.
    expect(research).toBeDefined();
    if (!research) return;

    expect(research.recorded).toBe(true);
    expect(research.runs).toBe(1);
    expect(research.costUsd).not.toBeNull();
    expect(research.costUsd).toBeGreaterThan(0);
  });

  it("still refuses to price a run whose usage was never recorded", () => {
    readResearchUsageSince.mockReturnValue(unrecordedRuns(3));
    const month = getSpendSummary(NOW).periods.find((p) => p.period === "month");
    const research = month?.sources.find((r) => r.source === "research");

    expect(research?.runs).toBe(3);
    // Nothing was added to the total for them: three unknown costs, not $0.00
    // of real spend.
    expect(research?.costUsd).toBe(0);
    expect(month?.totalUsd).toBe(0);
  });

  it("carries the exclusion on the summary so the console cannot omit it", () => {
    readResearchUsageSince.mockReturnValue(unrecordedRuns(3));
    const s = getSpendSummary(NOW);
    expect(s.unmeasured.join(" ")).toMatch(/deep research/i);
    expect(s.unmeasured.join(" ")).toContain("3");
  });

  it("says nothing about Deep Research when no research has run", () => {
    readResearchUsageSince.mockReturnValue([]);
    expect(getSpendSummary(NOW).unmeasured).toEqual([]);
  });
});

describe("getSpendSummary: the verdict is computed against the operator's own period", () => {
  it("is unset and silent on a fresh install", () => {
    const s = getSpendSummary(NOW);
    expect(s.policy.limitUsd).toBeNull();
    expect(s.verdict.state).toBe("unset");
    expect(s.verdict.message).toBeNull();
  });

  it("measures a daily budget against the day, not the month", () => {
    readSpendPolicy.mockReturnValue({ ...UNSET_SPEND_POLICY, limitUsd: 10, period: "day" });
    // Only the day window returns a run; week/month windows return nothing.
    readRunUsageSince.mockImplementation((since: string) =>
      since === "2026-08-23 00:00:00" ? [sonnetRun("agent")] : [],
    );

    const s = getSpendSummary(NOW);
    expect(s.budgetPeriod).toBe("day");
    expect(s.budgetSpentUsd).toBeCloseTo(18, 6);
    expect(s.verdict.state).toBe("over");
    expect(s.verdict.breached).toBe(true);
    // Clause 3: a figure alone warns, it does not stop.
    expect(s.verdict.blocksUnattended).toBe(false);
  });

  it("reports a stop as blocking only when the operator armed one", () => {
    readSpendPolicy.mockReturnValue({ ...UNSET_SPEND_POLICY, limitUsd: 10, period: "month", hardStop: true });
    readRunUsageSince.mockReturnValue([sonnetRun("agent")]);
    expect(getSpendSummary(NOW).verdict.blocksUnattended).toBe(true);
  });
});
