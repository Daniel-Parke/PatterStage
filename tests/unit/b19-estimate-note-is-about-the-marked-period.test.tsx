/** @jest-environment jsdom */
// ═══════════════════════════════════════════════════════════════
// T-0113: a mark and its explanation have to be about the SAME period.
//
// Two defects, both introduced by the spend-honesty fix earlier in this round,
// both about the same thing: the panel draws three period tiles and marks any
// of them whose money was priced at the fallback, but the sentence explaining
// the mark was built from the BUDGET period alone.
//
//   (1) A MARK POINTING AT NOTHING. The tile's tooltip said "See the note under
//       the sources", and on a default install there is a shape where no such
//       note exists. The budget period ships as "month" and the ISO week starts
//       on Monday, so in the first days of a month that does not begin on a
//       Monday the week window reaches back past the month boundary. Money spent
//       in those days is inside the week and outside the month: the week tile is
//       marked, the month basis is clean, `estimateNote` is null, and the panel
//       renders no note at all. The copy sent the operator to a paragraph that
//       is not on the screen.
//
//   (2) TWO MONEY NUMBERS THAT DISAGREE. The note read "$X of this period's
//       total is an estimate" and never said WHICH period, while all three
//       tiles pointed at it. With the budget on "day", the month tile can read
//       $12.00 "Estimated" directly above a single note saying $4.00. Two
//       figures for what looks like the same money is the defect class this
//       programme has already fixed once, in the same panel.
//
// THE CONTRACT. Every period carries its own note, computed from its own basis
// and naming its own period, so a tile that is marked always has an explanation
// and that explanation is about it. The prose under the source rows names the
// period it belongs to, and the source rows say so too.
// ═══════════════════════════════════════════════════════════════

import { render, screen } from "@testing-library/react";

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

jest.mock("lucide-react", () => ({
  Wallet: () => "W",
  AlertTriangle: () => "!",
  ShieldAlert: () => "S",
  Info: () => "i",
  Check: () => "y",
}));

import SpendPanel from "@/components/spend/SpendPanel";
import { UNSET_SPEND_POLICY, periodStart, type SpendPeriod } from "@/lib/spend/spend-law";
import { getSpendSummary } from "@/lib/spend/spend-summary";

// Wednesday 2 September 2026. Chosen, not arbitrary: the ISO week that contains
// it opened on Monday 31 August, which is in the PREVIOUS month, so the week
// window is strictly wider than the month window. That is the shape defect (1)
// needs and it happens on a default install four days in five.
const NOW = "2026-09-02T12:00:00.000Z";
const DAY_SINCE = periodStart("day", NOW);
const WEEK_SINCE = periodStart("week", NOW);
const MONTH_SINCE = periodStart("month", NOW);

const MILLION = 1_000_000;

/** 1M in + 1M out on a model no rate table knows: exactly $4.00 at the fallback. */
function unpriced(): SpendUsageRow {
  return {
    source: "agent",
    model: "minimax/minimax-m2",
    usage: JSON.stringify({ inputTokens: MILLION, outputTokens: MILLION, totalTokens: 2 * MILLION }),
  };
}

/**
 * The same tokens on a model the table does hold: exactly $18.00.
 *
 * Every window below mixes one of these in on purpose. A window of nothing but
 * fallbacks takes the "every figure is an estimate" branch, which carries no
 * dollar figure and so cannot show the two-numbers-that-disagree defect at all.
 * The mixed case is the one that prints money in the note.
 */
function priced(): SpendUsageRow {
  return {
    source: "agent",
    model: "anthropic/claude-sonnet-4",
    usage: JSON.stringify({ inputTokens: MILLION, outputTokens: MILLION, totalTokens: 2 * MILLION }),
  };
}

/** Windows are read one `since` at a time, so a scenario is written per window. */
function windows(rows: Record<string, SpendUsageRow[]>): void {
  readRunUsageSince.mockImplementation((since) => rows[since] ?? []);
}

function policy(period: SpendPeriod): void {
  readSpendPolicy.mockReturnValue({ ...UNSET_SPEND_POLICY, period });
}

beforeEach(() => {
  jest.clearAllMocks();
  policy("month");
  readRunUsageSince.mockReturnValue([]);
  readResearchUsageSince.mockReturnValue([]);
});

// ── (1) A mark always has an explanation, and it is on the same period ──

describe("a period marked as estimated is never marked alone", () => {
  it("puts the week's spend inside the week and outside the month, as a default install does", () => {
    // Guards the scenario itself. If period arithmetic ever changed so that the
    // week could not reach past the month boundary, the two cases below would
    // pass for the wrong reason and this one would fail first.
    windows({ [WEEK_SINCE]: [priced(), unpriced()] });

    const summary = getSpendSummary(NOW);
    const week = summary.periods.find((p) => p.period === "week");
    const month = summary.periods.find((p) => p.period === "month");
    expect(WEEK_SINCE < MONTH_SINCE).toBe(true);
    expect(week?.basis.estimatedUsd).toBeCloseTo(4, 6);
    expect(month?.basis.estimatedUsd).toBe(0);
  });

  it("gives every period its own note, so a marked week explains itself", () => {
    windows({ [WEEK_SINCE]: [priced(), unpriced()] });

    const summary = getSpendSummary(NOW);
    const week = summary.periods.find((p) => p.period === "week");
    const month = summary.periods.find((p) => p.period === "month");

    expect(week?.estimateNote ?? "").toMatch(/this week/i);
    expect(week?.estimateNote ?? "").toContain("$4.00");
    // Nothing about the month was a guess, so the month says nothing.
    expect(month?.estimateNote).toBeNull();
  });

  it("never sends the reader to a note that is not on the screen", () => {
    windows({ [WEEK_SINCE]: [priced(), unpriced()] });

    render(<SpendPanel summary={getSpendSummary(NOW)} onSave={jest.fn()} />);

    // The prose note under the sources is about the BUDGET period, which here
    // has nothing to admit, so it is correctly absent.
    expect(screen.queryByTestId("spend-rate-basis")).toBeNull();

    const mark = screen.getByTestId("spend-estimated-week");
    const title = mark.getAttribute("title") ?? "";
    expect(title).not.toMatch(/see the note/i);
    // It carries the explanation itself instead, about its own period.
    expect(title).toMatch(/this week/i);
    expect(title).toMatch(/fallback/i);
    expect(title).toContain("$4.00");
  });

  it("marks exactly the periods that have a note, and no others", () => {
    windows({ [WEEK_SINCE]: [priced(), unpriced()] });

    const summary = getSpendSummary(NOW);
    render(<SpendPanel summary={summary} onSave={jest.fn()} />);

    for (const p of summary.periods) {
      const marked = screen.queryByTestId(`spend-estimated-${p.period}`) !== null;
      expect([p.period, marked]).toEqual([p.period, p.estimateNote !== null]);
    }
  });
});

// ── (2) The figure in a note is the figure on the tile that points at it ──

describe("no two figures on this panel describe the same money differently", () => {
  it("puts the marked month tile's own total in the month's own note", () => {
    // The budget is on "day", so the one note the panel used to render was the
    // day's. $4.00 in a day, $12.00 in the month above it.
    policy("day");
    windows({
      [DAY_SINCE]: [priced(), unpriced()],
      [WEEK_SINCE]: [priced(), unpriced(), unpriced(), unpriced()],
      [MONTH_SINCE]: [priced(), unpriced(), unpriced(), unpriced()],
    });

    const summary = getSpendSummary(NOW);
    render(<SpendPanel summary={summary} onSave={jest.fn()} />);

    expect(screen.getByTestId("spend-total-month")).toHaveTextContent("$30.00");
    const monthTitle = screen.getByTestId("spend-estimated-month").getAttribute("title") ?? "";
    expect(monthTitle).toContain("$12.00");
    expect(monthTitle).toMatch(/this month/i);
    expect(monthTitle).not.toContain("$4.00 of");
  });

  it("makes the prose note say which period its figure belongs to", () => {
    policy("day");
    windows({
      [DAY_SINCE]: [priced(), unpriced()],
      [MONTH_SINCE]: [priced(), unpriced(), unpriced(), unpriced()],
    });

    render(<SpendPanel summary={getSpendSummary(NOW)} onSave={jest.fn()} />);

    const note = screen.getByTestId("spend-rate-basis").textContent ?? "";
    expect(note).toContain("$4.00");
    expect(note).toMatch(/today's total/i);
    // "this period" is the wording that made the number unattributable.
    expect(note).not.toMatch(/this period's total/i);
  });

  it("says which period the source rows are counting, since they are not all three", () => {
    policy("day");
    windows({
      [DAY_SINCE]: [priced(), unpriced()],
      [MONTH_SINCE]: [priced(), unpriced(), unpriced(), unpriced()],
    });

    render(<SpendPanel summary={getSpendSummary(NOW)} onSave={jest.fn()} />);

    expect(screen.getByTestId("spend-sources-period")).toHaveTextContent(/today/i);
  });

  it("still says nothing at all on an install where every rate was on file", () => {
    windows({
      [DAY_SINCE]: [
        {
          source: "agent",
          model: "anthropic/claude-sonnet-4",
          usage: JSON.stringify({ inputTokens: MILLION, outputTokens: MILLION }),
        },
      ],
    });

    const summary = getSpendSummary(NOW);
    render(<SpendPanel summary={summary} onSave={jest.fn()} />);

    expect(summary.periods.every((p) => p.estimateNote === null)).toBe(true);
    expect(screen.queryByTestId("spend-rate-basis")).toBeNull();
    expect(screen.queryByTestId("spend-estimated-day")).toBeNull();
  });
});
