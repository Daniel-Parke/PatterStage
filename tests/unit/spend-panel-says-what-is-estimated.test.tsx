/** @jest-environment jsdom */
// ═══════════════════════════════════════════════════════════════
// The panel's copy has to match what its numbers actually are.
//
// THE DEFECT. The tooltip beside "Provider spend" said "Prices are the
// published per-model rates". On an install running a model the rate table has
// never heard of, not one figure on screen came from a published rate: they all
// came from the fallback. The sentence was a claim about the product's
// knowledge, and it was false exactly where being false costs the operator
// money.
//
// THE CONTRACT. The panel never claims a rate it does not have. It marks the
// period tiles and the source rows that were priced at the fallback, it renders
// the summary's estimate note where the operator reads the total, and it says
// nothing extra on an install where every figure did come from a rate on file.
// ═══════════════════════════════════════════════════════════════

import { render, screen } from "@testing-library/react";

jest.mock("lucide-react", () => ({
  Wallet: () => "W",
  AlertTriangle: () => "!",
  ShieldAlert: () => "S",
  Info: () => "i",
  Check: () => "y",
}));

import SpendPanel from "@/components/spend/SpendPanel";
import { UNSET_SPEND_POLICY, evaluateSpend } from "@/lib/spend/spend-law";
import type { SpendSummary } from "@/lib/spend/spend-summary";
import type { SpendRateBasis, SpendWindowSource } from "@/lib/spend/spend-window";

const NO_ESTIMATE: SpendRateBasis = {
  knownUsd: 18,
  estimatedUsd: 0,
  unknownModels: [],
  runsWithoutModel: 0,
};

const ALL_ESTIMATE: SpendRateBasis = {
  knownUsd: 0,
  estimatedUsd: 18,
  unknownModels: ["minimax/minimax-m2"],
  runsWithoutModel: 0,
};

function source(
  over: Partial<SpendWindowSource> & Pick<SpendWindowSource, "source" | "label">,
): SpendWindowSource {
  return {
    runs: 2,
    inputTokens: 10,
    outputTokens: 5,
    costUsd: 18,
    recorded: true,
    estimatedUsd: 0,
    ...over,
  };
}

function summary(basis: SpendRateBasis, estimateNote: string | null, sources: SpendWindowSource[]): SpendSummary {
  const policy = { ...UNSET_SPEND_POLICY };
  // `estimateNote` on the ROW, not just on the summary. The mark on a period
  // tile is now driven by that period's own note, because a mark pointing at a
  // sentence built from a DIFFERENT period was two defects at once: it could
  // point at nothing, and where it pointed at something the dollars were not
  // this tile's. Every row here shares one basis, so it shares one note.
  const row = (period: "day" | "week" | "month", label: string) => ({
    period,
    label,
    since: "2026-09-01 00:00:00",
    totalUsd: 18,
    sources,
    unrecordedResearchRuns: 0,
    basis,
    estimateNote,
  });
  return {
    periods: [row("day", "Today"), row("week", "This week"), row("month", "This month")],
    policy,
    budgetPeriod: "month",
    budgetSpentUsd: 18,
    verdict: evaluateSpend(policy, 18),
    unmeasured: [],
    estimateNote,
    generatedAt: "2026-09-06T12:00:00.000Z",
  };
}

const priced = [
  source({ source: "agent", label: "Agent runs" }),
  source({ source: "composer", label: "Composer stages", costUsd: 4, estimatedUsd: 4 }),
];

describe("SpendPanel: the tooltip does not claim a rate the product has not got", () => {
  it("stops telling the operator the prices are the published per-model rates", () => {
    render(<SpendPanel summary={summary(ALL_ESTIMATE, "note", priced)} onSave={jest.fn()} />);
    const hint = screen.getByLabelText(/how this is estimated/i);
    expect(hint.getAttribute("title") ?? "").not.toMatch(/published per-model rates/i);
  });

  it("explains both cases instead: a rate on file, or a fallback it admits to", () => {
    render(<SpendPanel summary={summary(ALL_ESTIMATE, "note", priced)} onSave={jest.fn()} />);
    const title = screen.getByLabelText(/how this is estimated/i).getAttribute("title") ?? "";
    expect(title).toMatch(/fallback/i);
    expect(title).toMatch(/estimate, not an invoice/i);
  });
});

describe("SpendPanel: which figures are guesses", () => {
  it("marks a period whose whole figure came from the fallback", () => {
    render(<SpendPanel summary={summary(ALL_ESTIMATE, "note", priced)} onSave={jest.fn()} />);
    expect(screen.getByTestId("spend-estimated-month")).toHaveTextContent(/estimated/i);
  });

  it("marks nothing when every figure came from a rate on file", () => {
    render(<SpendPanel summary={summary(NO_ESTIMATE, null, [source({ source: "agent", label: "Agent runs" })])} onSave={jest.fn()} />);
    expect(screen.queryByTestId("spend-estimated-month")).toBeNull();
    expect(screen.queryByTestId("spend-rate-basis")).toBeNull();
  });

  it("marks the source row that was priced at the fallback, and leaves the other alone", () => {
    render(<SpendPanel summary={summary(ALL_ESTIMATE, "note", priced)} onSave={jest.fn()} />);
    expect(screen.getByTestId("spend-source-composer")).toHaveTextContent(/estimated/i);
    expect(screen.getByTestId("spend-source-agent")).not.toHaveTextContent(/estimated/i);
  });

  it("shows the summary's note where the operator reads the total", () => {
    const note = "Every figure in this period is an estimate.";
    render(<SpendPanel summary={summary(ALL_ESTIMATE, note, priced)} onSave={jest.fn()} />);
    expect(screen.getByTestId("spend-rate-basis")).toHaveTextContent(note);
  });
});
