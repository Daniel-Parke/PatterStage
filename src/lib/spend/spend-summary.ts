// spend/spend-summary.ts · the read-model the console draws: spend over the
// three periods, split by the three sources, plus the verdict.
//
// Every source is now priced, and how that came about is the contract: a
// comment claiming a source is priced is not evidence anything writes its
// tokens. Research got token columns in migration 034 (T-0030); Composer's
// usage was dropped by the reconciler until T-0058 while this file asserted
// otherwise, so its row read $0.00 as a measurement. Composer runs carry no
// model and are priced at DEFAULT_RATE.
//
// Research runs that predate 034 keep NULL token columns, and NULL is not
// zero: `foldResearch` counts them in the run count, skips them in the priced
// total and reports them through `unmeasured`, which the UI is asserted to
// render. `SpendSourceRow.recorded` is the older expression of the same idea;
// every row here sets it true, so the panel's "cost not recorded" branch is
// unreachable, but it is the contract an unrecorded FUTURE source would use.

import { DEFAULT_RATE } from "@/lib/analytics/model-cost";

import {
  SPEND_PERIODS,
  evaluateSpend,
  formatUsd,
  periodLabel,
  periodPossessive,
  periodStart,
  type SpendPeriod,
  type SpendPolicy,
  type SpendVerdict,
} from "./spend-law";
import { readSpendPolicy } from "./spend-repository";
import {
  emptyWindow,
  recordedSpendSince,
  type SpendRateBasis,
  type SpendWindowSource,
} from "./spend-window";

// Module-private on purpose: nothing imports the NAME, and an export nothing
// imports is what the widened knip gate exists to catch.
interface SpendPeriodRow {
  period: SpendPeriod;
  label: string;
  /** The calendar instant the window opened, in SQLite format. */
  since: string;
  /** Sum of the RECORDED sources only. */
  totalUsd: number;
  sources: SpendWindowSource[];
  /**
   * Research runs in this period whose token columns are NULL. On the row so
   * count and priced total come from ONE pass; two passes is how a row and its
   * sentence disagree, the defect T-0037 and T-0042 removed elsewhere.
   */
  unrecordedResearchRuns: number;
  /** What this period was priced from; per period, because a month can be a guess while a day is not. */
  basis: SpendRateBasis;
  /**
   * THIS period's admission that part of its figure is a guess, or null. On
   * the row, not only the summary: the panel used to point all three marks at
   * one sentence built from the budget period, so a week tile (the ISO week
   * reaches back past the month boundary early in a month) was marked with no
   * sentence, or with the budget period's dollar figure. Mark and explanation
   * are computed from one basis.
   */
  estimateNote: string | null;
}

export interface SpendSummary {
  /** day, week, month, always all three, so the console needs one request. */
  periods: SpendPeriodRow[];
  policy: SpendPolicy;
  /** The period the figure covers (meaningless while the figure is null). */
  budgetPeriod: SpendPeriod;
  /** Recorded spend inside that period. */
  budgetSpentUsd: number;
  verdict: SpendVerdict;
  /** What the totals above exclude, in sentences. Empty when they exclude nothing. */
  unmeasured: string[];
  /**
   * The budget period's own `estimateNote`, taken from the row, never
   * recomputed, so the prose under the source rows and the mark on the tile
   * cannot disagree. Not folded into `unmeasured`: that is money left OUT of
   * the total, this is money IN it but priced at a fallback.
   */
  estimateNote: string | null;
  generatedAt: string;
}

function safeRead<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function periodRow(period: SpendPeriod, nowIso: string): SpendPeriodRow {
  const since = periodStart(period, nowIso);
  // The one window helper, which the hard stop also calls, so the console and
  // the stop cannot total different money again (T-0108, D104). The summary
  // degrades to zeros; the guard does not, and must not.
  const w = safeRead(() => recordedSpendSince(since), emptyWindow(since));

  return {
    period,
    label: periodLabel(period),
    since,
    totalUsd: w.totalUsd,
    sources: w.sources,
    unrecordedResearchRuns: w.unrecordedResearchRuns,
    basis: w.basis,
    // Beside the basis it describes, so a tile's mark and its explanation are one read.
    estimateNote: estimateNoteFor(period, w.basis),
  };
}

/** "a", "a and b", "a, b and c", then "a, b, c and 2 more". */
function nameList(items: string[], cap = 3): string {
  const shown = items.slice(0, cap);
  const rest = items.length - shown.length;
  if (rest > 0) shown.push(`${rest} more`);
  if (shown.length === 1) return shown[0];
  return `${shown.slice(0, -1).join(", ")} and ${shown[shown.length - 1]}`;
}

/**
 * The sentence admitting which part of a period's figure is a guess. It names
 * the models, because "add a price for minimax-m2" is actionable and "some
 * rates are missing" is not, and it names the PERIOD: the first version said
 * "this period's total" for the budget period while three tiles pointed at it.
 */
function estimateNoteFor(period: SpendPeriod, basis: SpendRateBasis): string | null {
  if (basis.estimatedUsd <= 0) return null;

  const reasons: string[] = [];
  if (basis.unknownModels.length > 0) {
    reasons.push(`there is no price on file for ${nameList(basis.unknownModels)}`);
  }
  if (basis.runsWithoutModel > 0) {
    const n = basis.runsWithoutModel;
    reasons.push(`${n} run${n === 1 ? "" : "s"} recorded no model to price against`);
  }
  // Belt and braces: money was estimated, so there is always a reason for it.
  if (reasons.length === 0) reasons.push("no rate could be looked up");

  const reason = reasons.join(", and ");
  const whose = periodPossessive(period);
  const share =
    basis.knownUsd <= 0
      ? `Every figure in ${whose} total is an estimate.`
      : // Below a cent, the amount says nothing useful and reads as a bug.
        basis.estimatedUsd < 0.005
        ? `Part of ${whose} total is an estimate.`
        : `${formatUsd(basis.estimatedUsd)} of ${whose} total is an estimate.`;

  return (
    `${share} ${reason[0].toUpperCase()}${reason.slice(1)}, so they are priced at a ` +
    `fallback of ${formatUsd(DEFAULT_RATE.input)} per million input tokens and ` +
    `${formatUsd(DEFAULT_RATE.output)} per million output tokens. Check your ` +
    `provider's own billing page for what you were actually charged.`
  );
}

/**
 * The whole console answer. `nowIso` is injectable for the period arithmetic.
 * Every read degrades to zeros; the GUARD does NOT, and must not (spend-guard.ts).
 */
export function getSpendSummary(nowIso: string = new Date().toISOString()): SpendSummary {
  const policy = safeRead(readSpendPolicy, {
    limitUsd: null,
    period: "month" as SpendPeriod,
    hardStop: false,
    updatedAt: "",
  });

  const periods = SPEND_PERIODS.map((p) => periodRow(p, nowIso));
  const budget = periods.find((p) => p.period === policy.period) ?? periods[periods.length - 1];

  const unmeasured: string[] = [];
  // Only the runs that genuinely carry no counts. The trigger is purely
  // `promptTokens === null`, so the wording must not claim the runs "predate
  // token recording": a run created today with no usage is not old, and until
  // T-0068 every research run landed with null usage (llm.ts handed the
  // accumulator snake_case it read camelCase off), so the list could never empty.
  const unrecorded = budget.unrecordedResearchRuns;
  if (unrecorded > 0) {
    unmeasured.push(
      `${unrecorded} Deep Research run${unrecorded === 1 ? "" : "s"} in this period ` +
        `recorded no token usage, so ` +
        `${unrecorded === 1 ? "its cost is" : "their costs are"} not counted in the ` +
        `totals above.`,
    );
  }

  return {
    periods,
    policy,
    budgetPeriod: policy.period,
    budgetSpentUsd: budget.totalUsd,
    verdict: evaluateSpend(policy, budget.totalUsd),
    unmeasured,
    // From the row, never recomputed; two passes is how figure and sentence disagreed.
    estimateNote: budget.estimateNote,
    generatedAt: nowIso,
  };
}
