/** @jest-environment node */
// ═══════════════════════════════════════════════════════════════
// The money figure has to admit when it is a guess.
//
// THE DEFECT, found by driving the product against a real agent. The rate
// table in analytics/model-cost.ts knows fifteen model-id substrings and
// prices everything else at DEFAULT_RATE. This install runs MiniMax, which is
// in no row of that table, so EVERY figure the spend panel showed came from
// the fallback while the tooltip beside it told the operator the prices were
// "the published per-model rates". Confidently wrong about money is the worst
// thing this product can be.
//
// THE CONTRACT. Inventing a price for a model we do not know would be worse
// than the fallback, so the numbers do not change. What changes is that the
// pricing now REPORTS its own basis: every estimate says whether it came from
// a rate on file or from the fallback, a window totals the two separately and
// names the models it could not price, and the summary carries a sentence the
// panel is asserted to render.
// ═══════════════════════════════════════════════════════════════

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

import { DEFAULT_RATE, estimateCost, estimateCostWithBasis } from "@/lib/analytics/model-cost";
import { recordedSpendSince } from "@/lib/spend/spend-window";
import { getSpendSummary } from "@/lib/spend/spend-summary";
import { UNSET_SPEND_POLICY } from "@/lib/spend/spend-law";

const NOW = "2026-09-06T12:00:00.000Z";
const MILLION = 1_000_000;

/** 1M in + 1M out, so a rate reads straight off the money. */
function run(source: "agent" | "composer" | "story", model: string | null): SpendUsageRow {
  return {
    source,
    model,
    usage: JSON.stringify({ inputTokens: MILLION, outputTokens: MILLION, totalTokens: 2 * MILLION }),
  };
}

function research(model: string | null): ResearchUsageRow {
  return { promptTokens: MILLION, completionTokens: MILLION, model };
}

beforeEach(() => {
  jest.clearAllMocks();
  readSpendPolicy.mockReturnValue({ ...UNSET_SPEND_POLICY });
  readRunUsageSince.mockReturnValue([]);
  readResearchUsageSince.mockReturnValue([]);
});

// ── (A) The estimator reports its own basis ────────────────────

describe("estimateCostWithBasis", () => {
  it("says a figure came from a rate on file, and prices it the same as before", () => {
    const e = estimateCostWithBasis("anthropic/claude-sonnet-4", MILLION, MILLION);
    expect(e.fromKnownRate).toBe(true);
    expect(e.usd).toBeCloseTo(18, 6);
    // The basis is extra information, never a different number.
    expect(e.usd).toBeCloseTo(estimateCost("anthropic/claude-sonnet-4", MILLION, MILLION), 12);
  });

  it("says a figure is a fallback for a model it has never heard of", () => {
    const e = estimateCostWithBasis("minimax/minimax-m2", MILLION, MILLION);
    expect(e.fromKnownRate).toBe(false);
    expect(e.usd).toBeCloseTo(DEFAULT_RATE.input + DEFAULT_RATE.output, 6);
  });

  it("says a figure is a fallback when no model was recorded at all", () => {
    expect(estimateCostWithBasis(null, MILLION, MILLION).fromKnownRate).toBe(false);
    expect(estimateCostWithBasis(undefined, MILLION, MILLION).fromKnownRate).toBe(false);
  });
});

// ── (B) A window totals what it knows apart from what it guessed ──

describe("recordedSpendSince: the basis of the window's money", () => {
  it("counts a whole MiniMax install as estimated, and names the model", () => {
    readRunUsageSince.mockReturnValue([run("agent", "minimax/minimax-m2")]);

    const w = recordedSpendSince("2026-09-01 00:00:00");
    expect(w.basis.knownUsd).toBe(0);
    expect(w.basis.estimatedUsd).toBeCloseTo(w.totalUsd, 12);
    expect(w.basis.unknownModels).toEqual(["minimax/minimax-m2"]);
    expect(w.basis.runsWithoutModel).toBe(0);
  });

  it("splits a mixed window, so the operator can see which half is real", () => {
    readRunUsageSince.mockReturnValue([
      run("agent", "anthropic/claude-sonnet-4"),
      run("agent", "minimax/minimax-m2"),
    ]);

    const w = recordedSpendSince("2026-09-01 00:00:00");
    expect(w.basis.knownUsd).toBeCloseTo(18, 6);
    expect(w.basis.estimatedUsd).toBeCloseTo(DEFAULT_RATE.input + DEFAULT_RATE.output, 6);
    expect(w.basis.knownUsd + w.basis.estimatedUsd).toBeCloseTo(w.totalUsd, 6);
  });

  it("counts a run with no model as unpriceable rather than as an unknown model", () => {
    // Every Composer stage and every Story Weaver chapter lands here: no
    // mission, so no model dimension to look a rate up by.
    readRunUsageSince.mockReturnValue([run("composer", null)]);

    const w = recordedSpendSince("2026-09-01 00:00:00");
    expect(w.basis.unknownModels).toEqual([]);
    expect(w.basis.runsWithoutModel).toBe(1);
    expect(w.basis.estimatedUsd).toBeCloseTo(w.totalUsd, 12);
  });

  it("marks the source row itself, so the list says which line is a guess", () => {
    readRunUsageSince.mockReturnValue([
      run("agent", "anthropic/claude-sonnet-4"),
      run("composer", null),
    ]);

    const w = recordedSpendSince("2026-09-01 00:00:00");
    const agent = w.sources.find((s) => s.source === "agent");
    const composer = w.sources.find((s) => s.source === "composer");
    expect(agent?.estimatedUsd).toBe(0);
    expect(composer?.estimatedUsd).toBeCloseTo(composer?.costUsd ?? -1, 12);
  });

  it("prices Deep Research the same way, basis included", () => {
    readResearchUsageSince.mockReturnValue([research("minimax/minimax-m2"), research("claude-haiku")]);

    const w = recordedSpendSince("2026-09-01 00:00:00");
    expect(w.basis.unknownModels).toEqual(["minimax/minimax-m2"]);
    expect(w.basis.knownUsd).toBeCloseTo(4.8, 6); // haiku: 0.8 in + 4 out
  });

  it("names each unpriced model once, in a stable order", () => {
    readRunUsageSince.mockReturnValue([
      run("agent", "zeta-9"),
      run("agent", "minimax/minimax-m2"),
      run("agent", "minimax/minimax-m2"),
    ]);

    expect(recordedSpendSince("2026-09-01 00:00:00").basis.unknownModels).toEqual([
      "minimax/minimax-m2",
      "zeta-9",
    ]);
  });
});

// ── (C) The summary says it in a sentence ──────────────────────

describe("getSpendSummary: the estimate note", () => {
  it("says nothing when every figure came from a rate on file", () => {
    readRunUsageSince.mockReturnValue([run("agent", "anthropic/claude-sonnet-4")]);
    expect(getSpendSummary(NOW).estimateNote).toBeNull();
  });

  it("admits a wholly estimated period, names the model and gives the fallback rate", () => {
    readRunUsageSince.mockReturnValue([run("agent", "minimax/minimax-m2")]);

    const note = getSpendSummary(NOW).estimateNote ?? "";
    expect(note).toMatch(/estimate/i);
    expect(note).toContain("minimax/minimax-m2");
    expect(note).toContain("$1.00");
    expect(note).toContain("$3.00");
    // It must point somewhere real, because this number is not the bill.
    expect(note).toMatch(/provider/i);
  });

  it("quantifies the guessed part of a mixed period rather than condemning all of it", () => {
    readRunUsageSince.mockReturnValue([
      run("agent", "anthropic/claude-sonnet-4"),
      run("agent", "minimax/minimax-m2"),
    ]);

    const note = getSpendSummary(NOW).estimateNote ?? "";
    expect(note).toContain("$4.00");
    expect(note).not.toMatch(/every figure/i);
  });

  it("explains a run that recorded no model instead of naming a model it never had", () => {
    readRunUsageSince.mockReturnValue([run("composer", null), run("story", null)]);

    const note = getSpendSummary(NOW).estimateNote ?? "";
    expect(note).toMatch(/2 runs recorded no model/i);
    expect(note).not.toContain("null");
  });

  it("carries the basis on every period row, so each tile can mark itself", () => {
    readRunUsageSince.mockReturnValue([run("agent", "minimax/minimax-m2")]);

    for (const p of getSpendSummary(NOW).periods) {
      expect(p.basis.estimatedUsd).toBeCloseTo(p.totalUsd, 12);
    }
  });
});
