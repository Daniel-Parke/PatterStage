// ═══════════════════════════════════════════════════════════════
// spend/spend-summary.ts · the read-model the console draws
//
// Composes the repository reads and the law into one answer: what has been
// spent, over each of the three periods, split by the three sources, plus the
// verdict against whatever figure the operator has or has not set.
//
// ── THE HONESTY PROBLEM, WHICH IS THE POINT OF THIS FILE ───────
//
// Two of the three sources are recoverable from recorded data and one is not.
//
//   agent      a `runs` row with a mission. Tokens in `usage_json`, model on
//              the mission. Fully recoverable.
//   composer   a `runs` row with a `composer_node_run_id` and no mission.
//              Tokens in `usage_json`, no model dimension, so it is priced at
//              model-cost's conservative DEFAULT_RATE.
//   research   NOT RECOVERABLE. Deep Research calls `callLLM` directly and
//              throws the usage away; `research_runs` has no token or cost
//              column and `research_steps` stores text, not counts.
//
// A summary that folded the third one in as zero would be a lie that looks like
// a number, and it would make the hard stop under-count by an amount nobody
// could see. So the research row reports `recorded: false` and a NULL cost, the
// total sums only what was recorded, and `unmeasured` carries the exclusion up
// to the UI, which is asserted to render it.
//
// Making Deep Research measurable is a real piece of work (a usage column, a
// change to the engine's LlmFn contract, and a migration) and it is NOT this
// task: the row said to compute spend from what is already recorded. It is
// written up here so the next person finds the gap described rather than
// discovering it from a number that was quietly wrong.
// ═══════════════════════════════════════════════════════════════

import { estimateCost } from "@/lib/analytics/model-cost";
import {
  SPEND_PERIODS,
  evaluateSpend,
  periodLabel,
  periodStart,
  type SpendPeriod,
  type SpendPolicy,
  type SpendSource,
  type SpendVerdict,
} from "./spend-law";
import {
  readResearchUsageSince,
  readRunUsageSince,
  readSpendPolicy,
  type ResearchUsageRow,
  type SpendUsageRow,
} from "./spend-repository";

// Module-private on purpose. Reachable structurally through the exported
// parent type, so a caller can still read the field; nothing imports the
// NAME, and an export nothing imports is what the widened knip gate exists
// to catch. Export it again the moment a caller genuinely needs to name it.
interface SpendSourceRow {
  source: SpendSource;
  label: string;
  runs: number;
  inputTokens: number;
  outputTokens: number;
  /** Estimated USD, or NULL when this database never recorded the usage. */
  costUsd: number | null;
  /** False means "we do not know", never "it was free". */
  recorded: boolean;
}

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
  sources: SpendSourceRow[];
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

const SOURCE_LABELS: Record<SpendSource, string> = {
  agent: "Agent runs",
  composer: "Composer stages",
  research: "Deep Research",
};

function safeRead<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function emptySource(source: SpendSource, recorded: boolean): SpendSourceRow {
  return {
    source,
    label: SOURCE_LABELS[source],
    runs: 0,
    inputTokens: 0,
    outputTokens: 0,
    costUsd: recorded ? 0 : null,
    recorded,
  };
}

/** Fold the priced-run rows into the two recorded source totals. */
function foldUsage(rows: SpendUsageRow[]): Record<"agent" | "composer", SpendSourceRow> {
  const acc = {
    agent: emptySource("agent", true),
    composer: emptySource("composer", true),
  };

  for (const row of rows) {
    let input = 0;
    let output = 0;
    try {
      const u = JSON.parse(row.usage) as { inputTokens?: number; outputTokens?: number };
      input = Number(u.inputTokens ?? 0);
      output = Number(u.outputTokens ?? 0);
    } catch {
      // A run whose usage JSON will not parse recorded no usable counts. It is
      // skipped rather than guessed at: inventing a number here would be the
      // same lie as pricing Deep Research at zero, in a smaller place.
      continue;
    }
    if (!Number.isFinite(input)) input = 0;
    if (!Number.isFinite(output)) output = 0;

    const target = acc[row.source === "composer" ? "composer" : "agent"];
    target.runs += 1;
    target.inputTokens += input;
    target.outputTokens += output;
    // A null model (every Composer stage) resolves to model-cost's DEFAULT_RATE,
    // which is deliberately non-zero. Unknown must never read as free.
    target.costUsd = (target.costUsd ?? 0) + estimateCost(row.model, input, output);
  }

  return acc;
}

/**
 * Deep Research, folded the same way the other two sources are, plus a count of
 * the runs whose usage was NEVER recorded.
 *
 * The second number is the reason this cannot just call `foldUsage`. Every run
 * before migration 034 has NULL token columns, and NULL is not zero: it means
 * the cost is unknown. Those runs stay OUT of the priced total and stay
 * declared in `unmeasured`. Folding them in at zero would take a real,
 * uncounted cost and paint it as free, which is the same misreporting T-0030
 * removed, one layer further down.
 */
function foldResearch(rows: ResearchUsageRow[]): { row: SpendSourceRow; unrecorded: number } {
  const row = emptySource("research", true);
  let unrecorded = 0;

  for (const r of rows) {
    row.runs += 1;
    if (r.promptTokens === null && r.completionTokens === null) {
      unrecorded += 1;
      continue;
    }
    const input = Number.isFinite(r.promptTokens) ? (r.promptTokens as number) : 0;
    const output = Number.isFinite(r.completionTokens) ? (r.completionTokens as number) : 0;
    row.inputTokens += input;
    row.outputTokens += output;
    // A null model means the Hermes default, which resolves to model-cost's
    // DEFAULT_RATE. Deliberately non-zero: unknown must never read as free.
    row.costUsd = (row.costUsd ?? 0) + estimateCost(r.model, input, output);
  }

  return { row, unrecorded };
}

function periodRow(period: SpendPeriod, nowIso: string): SpendPeriodRow {
  const since = periodStart(period, nowIso);
  const folded = foldUsage(safeRead(() => readRunUsageSince(since), []));
  const research = foldResearch(safeRead(() => readResearchUsageSince(since), []));

  return {
    period,
    label: periodLabel(period),
    since,
    totalUsd:
      (folded.agent.costUsd ?? 0) + (folded.composer.costUsd ?? 0) + (research.row.costUsd ?? 0),
    sources: [folded.agent, folded.composer, research.row],
    unrecordedResearchRuns: research.unrecorded,
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
  // Only the runs that genuinely carry no counts. Since migration 034 a research
  // run records its tokens like any other source, so this list empties itself as
  // the pre-034 runs age out of the period rather than being suppressed.
  const unrecorded = budget.unrecordedResearchRuns;
  if (unrecorded > 0) {
    unmeasured.push(
      `${unrecorded} Deep Research run${unrecorded === 1 ? "" : "s"} in this period ` +
        `predate${unrecorded === 1 ? "s" : ""} token recording, so ` +
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
