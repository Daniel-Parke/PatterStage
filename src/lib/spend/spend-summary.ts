// ═══════════════════════════════════════════════════════════════
// spend/spend-summary.ts · the read-model the console draws
//
// Composes the repository reads and the law into one answer: what has been
// spent, over each of the three periods, split by the three sources, plus the
// verdict against whatever figure the operator has or has not set.
//
// ── THE HONESTY PROBLEM, WHICH IS THE POINT OF THIS FILE ───────
//
// All three sources are recoverable, and the third one only became so recently.
//
//   agent      a `runs` row with a mission. Tokens in `usage_json`, model on
//              the mission. Fully recoverable.
//   composer   a `runs` row with a `composer_node_run_id` and no mission.
//              Tokens in `usage_json`, no model dimension, so it is priced at
//              model-cost's conservative DEFAULT_RATE. Recoverable SINCE
//              T-0058: this comment previously asserted that pricing as
//              though it were already true, and it was not. The reconciler
//              dropped every stage's usage on the floor (run-reconcile.ts
//              diverts composer runs before the write), so the rows arrived
//              with a NULL usage_json and the read below excluded all of
//              them. The row said $0.00 and read as a measurement.
//   research   a `research_runs` row. Recoverable SINCE MIGRATION 034 (T-0030),
//              which added the token columns; before that the engine called
//              `callLLM` directly and threw the usage away.
//
// The honesty problem did not go away with 034, it MOVED -- and 034 was not the
// end of it. T-0058 found the same class again in Composer, which 034 had not
// measured, and the lesson is that a comment claiming a source is priced is not
// evidence that anything writes its tokens. Every research run that predates
// the migration keeps NULL token columns, and NULL is not zero:
// it means the cost is unknown. Folding those in at zero would be a lie that
// looks like a number, and it would make the hard stop under-count by an amount
// nobody could see. So `foldResearch` counts them in the run count, skips them
// in the priced total, and reports them through `unmeasured`, which the UI is
// asserted to render.
//
// `SpendSourceRow.recorded` is the older expression of the same idea, from when
// the whole research source was unrecorded. Every row this file builds now sets
// it true, so the panel's "cost not recorded" branch is currently unreachable.
// It is kept rather than deleted because it is the contract a genuinely
// unrecorded FUTURE source would use, and because deleting it would leave the
// panel with no way to say "unknown" at all.
//
// Making Deep Research measurable is a real piece of work (a usage column, a
// change to the engine's LlmFn contract, and a migration) and it is NOT this
// task: the row said to compute spend from what is already recorded. It is
// written up here so the next person finds the gap described rather than
// discovering it from a number that was quietly wrong.
// ═══════════════════════════════════════════════════════════════

import {
  SPEND_PERIODS,
  evaluateSpend,
  periodLabel,
  periodStart,
  type SpendPeriod,
  type SpendPolicy,
  type SpendVerdict,
} from "./spend-law";
import { readSpendPolicy } from "./spend-repository";
import { emptyWindow, recordedSpendSince, type SpendWindowSource } from "./spend-window";

// Module-private on purpose. Reachable structurally through the exported
// parent type, so a caller can still read the field; nothing imports the
// NAME, and an export nothing imports is what the widened knip gate exists
// to catch. Export it again the moment a caller genuinely needs to name it.
// Module-private on purpose. Reachable structurally through the exported
// parent type, so a caller can still read the field; nothing imports the
// NAME, and an export nothing imports is what the widened knip gate exists
// to catch. Export it again the moment a caller genuinely needs to name it.
interface SpendPeriodRow {
  period: SpendPeriod;
  label: string;
  /** The calendar instant the window opened, in SQLite format. */
  since: string;
  /** Sum of the RECORDED sources only. */
  totalUsd: number;
  sources: SpendWindowSource[];
  /**
   * Research runs in this period whose token columns are NULL.
   *
   * Carried on the row rather than recomputed by the caller, so the count and
   * the priced total come from ONE pass over the same rows. Two passes is how a
   * source row and the sentence describing it come to disagree, which is the
   * defect T-0037 and T-0042 spent their whole scope removing elsewhere.
   */
  unrecordedResearchRuns: number;
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
  };
}

/**
 * The whole console answer.
 *
 * `nowIso` is injectable so the period arithmetic is testable; it defaults to
 * the real clock. Every read is wrapped defensively, so a database that is
 * mid-migration yields zeros rather than a broken page. The GUARD does NOT
 * share that posture, and must not: see spend-guard.ts.
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
  // Only the runs that genuinely carry no counts.
  //
  // This used to say the runs "predate token recording" and that the list would
  // empty itself as pre-034 runs aged out. Both were false. The trigger is
  // purely `promptTokens === null` with no date comparison anywhere, so a run
  // created today with no usage was reported as predating the feature. And
  // until T-0068 EVERY research run landed with null usage, because llm.ts
  // handed the accumulator a snake_case object it read camelCase off, so the
  // list could never empty. The wording now describes this run's data rather
  // than making a claim about history it cannot check.
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
    generatedAt: nowIso,
  };
}
