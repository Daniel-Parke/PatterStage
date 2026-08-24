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
  countResearchRunsSince,
  readRunUsageSince,
  readSpendPolicy,
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

function periodRow(period: SpendPeriod, nowIso: string): SpendPeriodRow {
  const since = periodStart(period, nowIso);
  const folded = foldUsage(safeRead(() => readRunUsageSince(since), []));
  const research = emptySource("research", false);
  research.runs = safeRead(() => countResearchRunsSince(since), 0);

  return {
    period,
    label: periodLabel(period),
    since,
    totalUsd: (folded.agent.costUsd ?? 0) + (folded.composer.costUsd ?? 0),
    sources: [folded.agent, folded.composer, research],
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
  const researchRuns = budget.sources.find((s) => s.source === "research")?.runs ?? 0;
  if (researchRuns > 0) {
    unmeasured.push(
      `Deep Research records no token usage, so the ${researchRuns} research ` +
        `run${researchRuns === 1 ? "" : "s"} in this period ` +
        `${researchRuns === 1 ? "is" : "are"} not counted in the totals above.`,
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
