/** @jest-environment jsdom */
// ORACLE for T-0021 (WO-0014): the console surface.
//
// Clause 1 says spend is visible by default. Clause 2 says an install with no
// figure is not nagged, blocked or pre-configured. Those two pull in opposite
// directions in the UI, and this file is where the resolution is pinned down:
// the numbers are always on screen; the budget control is a quiet affordance
// that says nothing until the operator opens it; and the panel warns about
// exactly nothing until a figure exists.

import { render, screen, fireEvent } from "@testing-library/react";

jest.mock("lucide-react", () => ({
  Wallet: () => "W",
  AlertTriangle: () => "!",
  ShieldAlert: () => "S",
  Info: () => "i",
  Check: () => "y",
}));

import SpendPanel from "@/components/spend/SpendPanel";
import { UNSET_SPEND_POLICY, evaluateSpend, type SpendPolicy } from "@/lib/spend/spend-law";
import type { SpendSummary } from "@/lib/spend/spend-summary";

// `estimatedUsd` and `basis` arrived with the rate-honesty work: the panel now
// marks the figures that were priced at a fallback rather than at a rate the
// product holds. This fixture prices everything from a rate on file, so every
// assertion below still describes a panel with nothing extra on it; the
// estimated case has oracles of its own in
// spend-panel-says-what-is-estimated.test.tsx.
function summary(policy: SpendPolicy, spent: number, unmeasured: string[] = []): SpendSummary {
  const sources = (n: number) => [
    { source: "agent" as const, label: "Agent runs", runs: 2, inputTokens: 10, outputTokens: 5, costUsd: n, recorded: true, estimatedUsd: 0 },
    { source: "composer" as const, label: "Composer stages", runs: 1, inputTokens: 4, outputTokens: 2, costUsd: 0, recorded: true, estimatedUsd: 0 },
    { source: "research" as const, label: "Deep Research", runs: 3, inputTokens: 0, outputTokens: 0, costUsd: null, recorded: false, estimatedUsd: 0 },
  ];
  const basis = { knownUsd: spent, estimatedUsd: 0, unknownModels: [], runsWithoutModel: 0 };
  return {
    periods: [
      // unrecordedResearchRuns: 3 to match the `research` source row above, whose
      // runs are unpriced in this fixture. The two must agree, because the panel
      // renders the count from one and the money from the other (T-0030).
      { period: "day", label: "Today", since: "2026-08-23 00:00:00", totalUsd: 1, sources: sources(1), unrecordedResearchRuns: 3, basis, estimateNote: null },
      { period: "week", label: "This week", since: "2026-08-17 00:00:00", totalUsd: 5, sources: sources(5), unrecordedResearchRuns: 3, basis, estimateNote: null },
      { period: "month", label: "This month", since: "2026-08-01 00:00:00", totalUsd: spent, sources: sources(spent), unrecordedResearchRuns: 3, basis, estimateNote: null },
    ],
    policy,
    budgetPeriod: policy.period,
    budgetSpentUsd: spent,
    verdict: evaluateSpend(policy, spent),
    unmeasured,
    estimateNote: null,
    generatedAt: "2026-08-23T14:00:00.000Z",
  };
}

const unset = { ...UNSET_SPEND_POLICY };
const setNoStop: SpendPolicy = { ...UNSET_SPEND_POLICY, limitUsd: 100, period: "month" };
const setWithStop: SpendPolicy = { ...setNoStop, hardStop: true };

describe("SpendPanel: clause 1, spend is visible by default", () => {
  it("shows a total for every period", () => {
    render(<SpendPanel summary={summary(unset, 42)} onSave={jest.fn()} />);
    expect(screen.getByTestId("spend-total-day")).toHaveTextContent("$1.00");
    expect(screen.getByTestId("spend-total-week")).toHaveTextContent("$5.00");
    expect(screen.getByTestId("spend-total-month")).toHaveTextContent("$42.00");
  });

  it("breaks the selected period down by source", () => {
    render(<SpendPanel summary={summary(unset, 42)} onSave={jest.fn()} />);
    expect(screen.getByTestId("spend-source-agent")).toHaveTextContent("Agent runs");
    expect(screen.getByTestId("spend-source-composer")).toHaveTextContent("Composer stages");
    expect(screen.getByTestId("spend-source-research")).toHaveTextContent("Deep Research");
  });

  // Honesty over tidiness: a source whose spend this database never recorded
  // must not be drawn as $0.00, which reads as "this cost nothing".
  it("shows an unrecorded source as unrecorded, never as zero", () => {
    render(<SpendPanel summary={summary(unset, 42)} onSave={jest.fn()} />);
    const research = screen.getByTestId("spend-source-research");
    expect(research).not.toHaveTextContent("$0.00");
    expect(research).toHaveTextContent(/not recorded/i);
  });

  it("shows what the total excludes when there is something to exclude", () => {
    render(<SpendPanel summary={summary(unset, 42, ["Deep Research records no token usage."])} onSave={jest.fn()} />);
    expect(screen.getByTestId("spend-unmeasured")).toHaveTextContent(/deep research/i);
  });

  it("shows no exclusion note when there is nothing to exclude", () => {
    render(<SpendPanel summary={summary(unset, 42)} onSave={jest.fn()} />);
    expect(screen.queryByTestId("spend-unmeasured")).toBeNull();
  });
});

describe("SpendPanel: clause 2, an install with no figure is not nagged", () => {
  it("warns about nothing", () => {
    render(<SpendPanel summary={summary(unset, 9_999)} onSave={jest.fn()} />);
    expect(screen.queryByTestId("spend-warning")).toBeNull();
    expect(screen.queryByTestId("spend-stopped")).toBeNull();
  });

  it("draws no budget meter, because there is no budget", () => {
    render(<SpendPanel summary={summary(unset, 9_999)} onSave={jest.fn()} />);
    expect(screen.queryByTestId("spend-meter")).toBeNull();
  });

  // The budget form is behind a click. A panel that opens on an empty required
  // field is the thing the operator's ruling was written against.
  it("keeps the budget form closed until it is asked for", () => {
    render(<SpendPanel summary={summary(unset, 10)} onSave={jest.fn()} />);
    expect(screen.queryByTestId("spend-limit-input")).toBeNull();
    fireEvent.click(screen.getByTestId("spend-budget-toggle"));
    expect(screen.getByTestId("spend-limit-input")).toBeInTheDocument();
  });

  it("will not let a stop be armed while there is no figure to arm it against", () => {
    render(<SpendPanel summary={summary(unset, 10)} onSave={jest.fn()} />);
    fireEvent.click(screen.getByTestId("spend-budget-toggle"));
    expect(screen.getByTestId("spend-hard-stop")).toBeDisabled();
  });
});

describe("SpendPanel: clause 3, a set figure warns", () => {
  it("draws the meter and stays quiet below the warning line", () => {
    render(<SpendPanel summary={summary(setNoStop, 10)} onSave={jest.fn()} />);
    expect(screen.getByTestId("spend-meter")).toBeInTheDocument();
    expect(screen.queryByTestId("spend-warning")).toBeNull();
  });

  it("warns when the figure is passed, and says plainly that nothing was stopped", () => {
    render(<SpendPanel summary={summary(setNoStop, 120)} onSave={jest.fn()} />);
    expect(screen.getByTestId("spend-warning")).toBeInTheDocument();
    expect(screen.queryByTestId("spend-stopped")).toBeNull();
    expect(screen.getByTestId("spend-warning")).toHaveTextContent(/nothing has been stopped/i);
  });
});

describe("SpendPanel: clauses 4 and 5, the stop and the human", () => {
  it("says unattended work is paused when the armed figure is breached", () => {
    render(<SpendPanel summary={summary(setWithStop, 120)} onSave={jest.fn()} />);
    expect(screen.getByTestId("spend-stopped")).toHaveTextContent(/unattended/i);
  });

  // Clause 5, said out loud where the operator will read it. If the panel did
  // not say this, a stopped install would look broken rather than governed.
  it("says a human can still dispatch by hand", () => {
    render(<SpendPanel summary={summary(setWithStop, 120)} onSave={jest.fn()} />);
    expect(screen.getByTestId("spend-stopped")).toHaveTextContent(/dispatch/i);
  });
});

describe("SpendPanel: saving", () => {
  it("sends the figure and period the operator typed", () => {
    const onSave = jest.fn();
    render(<SpendPanel summary={summary(unset, 0)} onSave={onSave} />);
    fireEvent.click(screen.getByTestId("spend-budget-toggle"));
    fireEvent.change(screen.getByTestId("spend-limit-input"), { target: { value: "40" } });
    fireEvent.change(screen.getByTestId("spend-period-select"), { target: { value: "week" } });
    fireEvent.click(screen.getByTestId("spend-save"));
    expect(onSave).toHaveBeenCalledWith({ limitUsd: 40, period: "week", hardStop: false });
  });

  it("sends a cleared figure as null, and disarms the stop with it", () => {
    const onSave = jest.fn();
    render(<SpendPanel summary={summary(setWithStop, 10)} onSave={onSave} />);
    fireEvent.click(screen.getByTestId("spend-budget-toggle"));
    fireEvent.change(screen.getByTestId("spend-limit-input"), { target: { value: "" } });
    fireEvent.click(screen.getByTestId("spend-save"));
    expect(onSave).toHaveBeenCalledWith({ limitUsd: null, period: "month", hardStop: false });
  });

  it("refuses to send a figure that is not a positive number", () => {
    const onSave = jest.fn();
    render(<SpendPanel summary={summary(unset, 0)} onSave={onSave} />);
    fireEvent.click(screen.getByTestId("spend-budget-toggle"));
    fireEvent.change(screen.getByTestId("spend-limit-input"), { target: { value: "-3" } });
    fireEvent.click(screen.getByTestId("spend-save"));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByTestId("spend-form-error")).toBeInTheDocument();
  });

  it("renders nothing but a placeholder before the summary has loaded", () => {
    render(<SpendPanel summary={undefined} onSave={jest.fn()} />);
    expect(screen.getByTestId("spend-loading")).toBeInTheDocument();
  });
});
