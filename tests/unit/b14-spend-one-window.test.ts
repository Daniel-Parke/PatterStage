/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports -- spend-window.ts is the module this contract creates, so it is loaded through a guarded require and reds its own tests rather than failing the file to load */

// ═══════════════════════════════════════════════════════════════
// B14 oracle, group spend-plumbing, part two: one window, four sources
// (D87 and D104, both blockers). Contract sections 2.1, 2.4 and 2.5.
//
// THE DEFECT, in two halves that are really one.
//
//   D87  SPEND_SOURCES names three things. Story Weaver is a fourth, and it
//        records nothing at all, so the console's figure is not a measurement.
//   D104 getSpendSummary totals agent + Composer + Deep Research
//        (spend-summary.ts:229). spend-guard totals recorded RUN usage only
//        (spend-guard.ts:57-68) and never touches research_runs. On an install
//        whose spend is mostly Deep Research, the panel can draw a full meter
//        and print the red hard-stop sentence while the scheduler, the queue
//        drain and Composer keep dispatching. The gate counts less money than
//        the picture above it.
//
// THE CONTRACT. `recordedSpendSince(since)` in src/lib/spend/spend-window.ts is
// the ONE "recorded spend in this window" helper. It folds all four sources and
// THROWS on a failed read; the summary wraps it in safeRead and degrades to
// zeros, the guard does not and refuses. Both then quote the same number.
//
// The doubles are the repository's three reads. Everything above them is real:
// the fold, estimateCost's rate table and the law.
// ═══════════════════════════════════════════════════════════════

import { SPEND_SOURCES, UNSET_SPEND_POLICY, type SpendPolicy } from "@/lib/spend/spend-law";

const readSpendPolicy = jest.fn();
const readRunUsageSince = jest.fn();
const readResearchUsageSince = jest.fn();

jest.mock("@/lib/spend/spend-repository", () => ({
  readSpendPolicy: () => readSpendPolicy(),
  readRunUsageSince: (since: string) => readRunUsageSince(since),
  readResearchUsageSince: (since: string) => readResearchUsageSince(since),
  writeSpendPolicy: jest.fn(),
}));

import { getSpendSummary } from "@/lib/spend/spend-summary";
import { checkUnattendedSpend } from "@/lib/spend/spend-guard";

// ── the shared helper, loaded loosely so this file runs before it exists ──

interface SpendWindowSource {
  source: string;
  label: string;
  runs: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number | null;
  recorded: boolean;
}
interface SpendWindow {
  since: string;
  totalUsd: number;
  sources: SpendWindowSource[];
  unrecordedResearchRuns: number;
}
interface SpendWindowModule {
  recordedSpendSince: (since: string) => SpendWindow;
}

function loadWindow(): SpendWindowModule | null {
  try {
    return require("@/lib/spend/spend-window") as SpendWindowModule;
  } catch {
    return null;
  }
}

// ── fixtures ────────────────────────────────────────────────────

const NOW = "2026-09-15T12:00:00.000Z";
const MILLION = 1_000_000;

/** 1M in + 1M out on sonnet = $18. */
const AGENT_18 = {
  source: "agent" as const,
  model: "anthropic/claude-sonnet-4",
  usage: JSON.stringify({ inputTokens: MILLION, outputTokens: MILLION }),
};
/** A Story Weaver row: no mission, so no model dimension -> DEFAULT_RATE (1/3) = $4. */
const STORY_4 = {
  source: "story" as const,
  model: null,
  usage: JSON.stringify({ inputTokens: MILLION, outputTokens: MILLION }),
};
/** One Deep Research run on sonnet = $18. */
const RESEARCH_18 = {
  promptTokens: MILLION,
  completionTokens: MILLION,
  model: "anthropic/claude-sonnet-4",
};
/** A pre-034 research run: unknown, not free. */
const RESEARCH_UNRECORDED = { promptTokens: null, completionTokens: null, model: null };

function policy(over: Partial<SpendPolicy> = {}): SpendPolicy {
  return { ...UNSET_SPEND_POLICY, ...over };
}

/**
 * A source row by name. Cast loosely because SPEND_SOURCES does not admit
 * 'story' until the contract lands, so the comparison would not type-check
 * against today's union. Strip the cast once B14 is in.
 */
function sourceRow(
  sources: ReadonlyArray<{ source: string; label: string; costUsd: number | null; runs: number; recorded: boolean }>,
  name: string,
) {
  const row = (sources as ReadonlyArray<{ source: string; label: string; costUsd: number | null; runs: number; recorded: boolean }>).find(
    (s) => s.source === name,
  );
  if (!row) throw new Error(`no ${name} source row (contract 2.1)`);
  return row;
}

/** The dollar figure the guard's refusal quotes. */
function refusedAmount(reason: string | null): number {
  const m = /\$([\d,]+\.\d{2})/.exec(reason ?? "");
  return m ? Number(m[1].replace(/,/g, "")) : NaN;
}

beforeEach(() => {
  jest.clearAllMocks();
  readSpendPolicy.mockReturnValue(policy());
  readRunUsageSince.mockReturnValue([]);
  readResearchUsageSince.mockReturnValue([]);
});

// ═══════════════════════════════════════════════════════════════
// (A) the vocabulary
// ═══════════════════════════════════════════════════════════════

describe("the four things that spend provider tokens", () => {
  it("SPEND_SOURCES names Story Weaver beside the other three", () => {
    expect([...SPEND_SOURCES]).toEqual(["agent", "composer", "research", "story"]);
  });

  it("the summary carries a Story Weaver row, labelled for a person", () => {
    readRunUsageSince.mockReturnValue([STORY_4]);
    const month = getSpendSummary(NOW).periods.find((p) => p.period === "month")!;

    expect(month.sources.map((s) => s.source)).toEqual(["agent", "composer", "research", "story"]);
    const story = sourceRow(month.sources, "story");
    expect(story.label).toBe("Story Weaver");
    expect(story.runs).toBe(1);
    expect(story.recorded).toBe(true);
    // A null model is priced at model-cost's conservative default, never free.
    expect(story.costUsd).toBeCloseTo(4, 6);
  });
});

// ═══════════════════════════════════════════════════════════════
// (B) ONE helper, and both readers use it
// ═══════════════════════════════════════════════════════════════

describe("recordedSpendSince is the one window both readers total", () => {
  it("exists, and folds every source into one figure", () => {
    const mod = loadWindow();
    expect(mod).not.toBeNull();

    readRunUsageSince.mockReturnValue([AGENT_18, STORY_4]);
    readResearchUsageSince.mockReturnValue([RESEARCH_18, RESEARCH_UNRECORDED]);

    const w = mod!.recordedSpendSince("2026-09-01 00:00:00");
    expect(w.totalUsd).toBeCloseTo(18 + 4 + 18, 6);
    expect(w.sources.map((s) => s.source)).toEqual(["agent", "composer", "research", "story"]);
    // NULL is not zero: the run is counted and declared, never priced.
    expect(w.unrecordedResearchRuns).toBe(1);
  });

  it("throws rather than degrading, so the guard can keep its own posture", () => {
    const mod = loadWindow();
    expect(mod).not.toBeNull();
    readRunUsageSince.mockImplementation(() => {
      throw new Error("database is locked");
    });
    expect(() => mod!.recordedSpendSince("2026-09-01 00:00:00")).toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════
// (C) the parity the plan asks to verify
// ═══════════════════════════════════════════════════════════════

describe("the hard stop counts exactly what the panel above it shows", () => {
  it("the guard's figure equals the summary's, across all four sources", () => {
    readSpendPolicy.mockReturnValue(policy({ limitUsd: 5, period: "month", hardStop: true }));
    readRunUsageSince.mockReturnValue([AGENT_18, STORY_4]);
    readResearchUsageSince.mockReturnValue([RESEARCH_18]);

    const summary = getSpendSummary(NOW);
    const verdict = checkUnattendedSpend();

    expect(summary.budgetSpentUsd).toBeCloseTo(40, 6);
    expect(verdict.allowed).toBe(false);
    expect(refusedAmount(verdict.reason)).toBeCloseTo(Number(summary.budgetSpentUsd.toFixed(2)), 6);
  });

  it("Deep Research alone can breach the stop (D104: it could not before)", () => {
    readSpendPolicy.mockReturnValue(policy({ limitUsd: 10, period: "month", hardStop: true }));
    readRunUsageSince.mockReturnValue([]);
    readResearchUsageSince.mockReturnValue([RESEARCH_18]);

    const verdict = checkUnattendedSpend();
    expect(verdict.allowed).toBe(false);
    expect(refusedAmount(verdict.reason)).toBeCloseTo(18, 6);
  });

  it("Story Weaver breaches the stop AS Story Weaver, not as an agent run", () => {
    readSpendPolicy.mockReturnValue(policy({ limitUsd: 3, period: "month", hardStop: true }));
    readRunUsageSince.mockReturnValue([STORY_4]);
    readResearchUsageSince.mockReturnValue([]);

    const verdict = checkUnattendedSpend();
    expect(verdict.allowed).toBe(false);
    expect(refusedAmount(verdict.reason)).toBeCloseTo(4, 6);

    // The gate blocking is half of it. Today a 'story' row would be folded
    // into `agent` by foldUsage's two-way branch, so the console would blame
    // the agent for money Story Weaver spent. It has to land on its own row.
    const month = getSpendSummary(NOW).periods.find((p) => p.period === "month")!;
    expect(sourceRow(month.sources, "agent").costUsd).toBeCloseTo(0, 6);
    expect(sourceRow(month.sources, "story").costUsd).toBeCloseTo(4, 6);
  });
});

// ═══════════════════════════════════════════════════════════════
// GREEN CONTROL: the postures B14 must not flatten
// ═══════════════════════════════════════════════════════════════

describe("GREEN CONTROL: what sharing one helper must NOT change", () => {
  it("a research run whose usage was never recorded is still not folded in at zero", () => {
    readSpendPolicy.mockReturnValue(policy({ limitUsd: 1, period: "month", hardStop: true }));
    readResearchUsageSince.mockReturnValue([RESEARCH_UNRECORDED]);

    // Nothing measurable was spent, so nothing is refused on an unknown.
    expect(checkUnattendedSpend().allowed).toBe(true);
    // And the console says so rather than printing $0.00 as a measurement.
    expect(getSpendSummary(NOW).unmeasured.join(" ")).toMatch(/Deep Research/);
  });

  it("no figure still never prices the window", () => {
    expect(checkUnattendedSpend()).toEqual({ allowed: true, reason: null });
    expect(readRunUsageSince).not.toHaveBeenCalled();
    expect(readResearchUsageSince).not.toHaveBeenCalled();
  });

  it("a figure with the stop off still never blocks, however far over", () => {
    readSpendPolicy.mockReturnValue(policy({ limitUsd: 1, period: "month" }));
    readRunUsageSince.mockReturnValue([AGENT_18]);
    expect(checkUnattendedSpend().allowed).toBe(true);
  });

  it("the guard still fails CLOSED when the spend read breaks under an armed stop", () => {
    readSpendPolicy.mockReturnValue(policy({ limitUsd: 10, period: "month", hardStop: true }));
    readRunUsageSince.mockImplementation(() => {
      throw new Error("database is locked");
    });

    const v = checkUnattendedSpend();
    expect(v.allowed).toBe(false);
    expect(v.reason).toMatch(/could not be measured/i);
  });

  it("the summary still fails OPEN, to zeros, so a mid-migration console still draws", () => {
    readRunUsageSince.mockImplementation(() => {
      throw new Error("no such column: spend_source");
    });
    readResearchUsageSince.mockImplementation(() => {
      throw new Error("no such table: research_runs");
    });

    const summary = getSpendSummary(NOW);
    expect(summary.budgetSpentUsd).toBe(0);
    expect(summary.periods).toHaveLength(3);
  });
});
