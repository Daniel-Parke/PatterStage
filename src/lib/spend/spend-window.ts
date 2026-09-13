// ═══════════════════════════════════════════════════════════════
// spend-window.ts — recorded spend inside one window, from every source
// ═══════════════════════════════════════════════════════════════
//
// The console and the hard stop used to total the window separately: the
// summary folded three sources, the guard priced agent and composer runs only.
// They disagreed by exactly the money Deep Research had spent, which meant the
// stop counted less than the panel above it showed (T-0108, D104). They call
// this now, and cannot drift again.
//
// NULL is not zero. A research run recorded before migration 034 has null token
// columns, which means "we do not know what this cost", and it stays out of the
// priced total while staying declared in the count. Folding it in at zero would
// take a real, uncounted cost and paint it as free.
//
// A SECOND KIND OF NOT-KNOWING, which this file also has to carry. A run whose
// tokens ARE recorded can still be priced at a rate nobody published: the table
// in model-cost.ts knows fifteen model families, and an install running
// anything else is priced entirely at its fallback. The arithmetic is fine and
// deliberately unchanged. What was missing is that nothing said so, so the
// console described a screen of guesses as published rates. The folds below
// therefore keep a `SpendRateBasis` beside the money: what was priced from a
// rate on file, what was not, and which models it could not price.

import { estimateCostWithBasis } from "@/lib/analytics/model-cost";
import { SPEND_SOURCES, type SpendSource } from "./spend-law";
import {
  readResearchUsageSince,
  readRunUsageForStory,
  readRunUsageSince,
  type ResearchUsageRow,
  type SpendUsageRow,
} from "./spend-repository";

const SOURCE_LABELS: Record<SpendSource, string> = {
  agent: "Agent runs",
  composer: "Composer stages",
  research: "Deep Research",
  story: "Story Weaver",
};

export interface SpendWindowSource {
  source: SpendSource;
  label: string;
  runs: number;
  inputTokens: number;
  outputTokens: number;
  /** Estimated USD, or NULL when this database never recorded the usage. */
  costUsd: number | null;
  /** False means "we do not know", never "it was free". */
  recorded: boolean;
  /** How much of costUsd was priced at the fallback rather than a rate on file. */
  estimatedUsd: number;
}

/** Where a window's money came from: a rate on file, or the fallback. */
export interface SpendRateBasis {
  /** USD priced from a rate the product actually has on file. */
  knownUsd: number;
  /** USD priced at the fallback rate, because no rate is on file. */
  estimatedUsd: number;
  /** Distinct model ids priced at the fallback, sorted, so copy can name them. */
  unknownModels: string[];
  /** Runs that recorded no model at all, so no rate could be looked up. */
  runsWithoutModel: number;
}

export interface SpendWindow {
  since: string;
  /** Sum of the RECORDED sources only. */
  totalUsd: number;
  /** Always one row per source, in SPEND_SOURCES order. */
  sources: SpendWindowSource[];
  unrecordedResearchRuns: number;
  basis: SpendRateBasis;
}

function emptySource(source: SpendSource, recorded: boolean): SpendWindowSource {
  return {
    source,
    label: SOURCE_LABELS[source],
    runs: 0,
    inputTokens: 0,
    outputTokens: 0,
    costUsd: recorded ? 0 : null,
    recorded,
    estimatedUsd: 0,
  };
}

function emptyBasis(): SpendRateBasis {
  return { knownUsd: 0, estimatedUsd: 0, unknownModels: [], runsWithoutModel: 0 };
}

/** An answer for a window nothing could be read from. */
export function emptyWindow(since: string): SpendWindow {
  return {
    since,
    totalUsd: 0,
    sources: SPEND_SOURCES.map((s) => emptySource(s, true)),
    unrecordedResearchRuns: 0,
    basis: emptyBasis(),
  };
}

/**
 * The running basis of one window, filled in row by row.
 *
 * One accumulator shared by every fold, so the money the console prints and the
 * sentence it prints beside it come from ONE pass over the same rows. Two
 * passes is how a figure and its own description come to disagree.
 */
class BasisAccumulator {
  private knownUsd = 0;
  private estimatedUsd = 0;
  private readonly unknownModels = new Set<string>();
  private runsWithoutModel = 0;

  /** Record one priced run. Returns the part of its cost that was guessed. */
  add(model: string | null, costUsd: number, fromKnownRate: boolean): number {
    if (fromKnownRate) {
      this.knownUsd += costUsd;
      return 0;
    }
    this.estimatedUsd += costUsd;
    // A model we hold no price for can be NAMED, which is the useful half of
    // the admission. A run with no model at all cannot be, and printing "no
    // price for null" would be worse than saying nothing.
    if (model) this.unknownModels.add(model);
    else this.runsWithoutModel += 1;
    return costUsd;
  }

  result(): SpendRateBasis {
    return {
      knownUsd: this.knownUsd,
      estimatedUsd: this.estimatedUsd,
      unknownModels: [...this.unknownModels].sort(),
      runsWithoutModel: this.runsWithoutModel,
    };
  }
}

/** Fold the priced-run rows into their source totals. */
function foldUsage(
  rows: SpendUsageRow[],
  // Each source row's own `estimatedUsd` is filled in either way. The shared
  // accumulator is only wanted by a caller that reports a WINDOW's basis, so a
  // fold of some narrower slice may let this default and throw it away.
  basis: BasisAccumulator = new BasisAccumulator(),
): Record<"agent" | "composer" | "story", SpendWindowSource> {
  const acc = {
    agent: emptySource("agent", true),
    composer: emptySource("composer", true),
    story: emptySource("story", true),
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

    const key: "agent" | "composer" | "story" =
      row.source === "composer" || row.source === "story" ? row.source : "agent";
    const target = acc[key];
    target.runs += 1;
    target.inputTokens += input;
    target.outputTokens += output;
    // A null model (every Composer stage, every story chapter) resolves to
    // model-cost's DEFAULT_RATE, which is deliberately non-zero. Unknown must
    // never read as free, and it must never read as priced either.
    const priced = estimateCostWithBasis(row.model, input, output);
    target.costUsd = (target.costUsd ?? 0) + priced.usd;
    target.estimatedUsd += basis.add(row.model, priced.usd, priced.fromKnownRate);
  }

  return acc;
}

/**
 * Deep Research, folded the same way, plus a count of the runs whose usage was
 * NEVER recorded. That second number is why this cannot just call foldUsage.
 */
function foldResearch(
  rows: ResearchUsageRow[],
  basis: BasisAccumulator = new BasisAccumulator(),
): { row: SpendWindowSource; unrecorded: number } {
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
    const priced = estimateCostWithBasis(r.model, input, output);
    row.costUsd = (row.costUsd ?? 0) + priced.usd;
    row.estimatedUsd += basis.add(r.model, priced.usd, priced.fromKnownRate);
  }

  return { row, unrecorded };
}

/**
 * Recorded spend inside a window, from every source.
 *
 * THROWS. It is the caller that decides what a failed read means, and the two
 * callers do not agree: the summary degrades to zeros so a mid-migration
 * database still renders a page, the guard refuses so an unreadable ledger
 * never reads as an unspent budget. Swallowing here would take that choice
 * away from the one caller whose choice costs money.
 */
export function recordedSpendSince(since: string): SpendWindow {
  const basis = new BasisAccumulator();
  const folded = foldUsage(readRunUsageSince(since), basis);
  const research = foldResearch(readResearchUsageSince(since), basis);

  const byKey: Record<SpendSource, SpendWindowSource> = {
    agent: folded.agent,
    composer: folded.composer,
    research: research.row,
    story: folded.story,
  };

  return {
    since,
    totalUsd: SPEND_SOURCES.reduce((sum, s) => sum + (byKey[s].costUsd ?? 0), 0),
    sources: SPEND_SOURCES.map((s) => byKey[s]),
    unrecordedResearchRuns: research.unrecorded,
    basis: basis.result(),
  };
}

/**
 * What ONE story has cost, over its whole life, in the same row shape the
 * console draws per source.
 *
 * The Rec Room asks for this so a person can see what a story cost without
 * leaving the page that spent it: generation calls a paid model, and Story
 * Weaver said nothing about it before, during or after.
 *
 * It goes through `foldUsage`, the same function the window read uses, on
 * purpose. Totalling a story separately is exactly how the reader and the
 * console would come to show two different numbers for the same money.
 *
 * THROWS, like `recordedSpendSince`, so the caller decides what an unreadable
 * ledger means. The story handler answers a failure rather than an invented
 * $0.00, because a confident zero is the one answer this must never give.
 */
export function recordedSpendForStory(storyId: string): SpendWindowSource {
  return foldUsage(readRunUsageForStory(storyId)).story;
}
