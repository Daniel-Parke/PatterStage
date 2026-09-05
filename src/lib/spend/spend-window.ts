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

import { estimateCost } from "@/lib/analytics/model-cost";
import { SPEND_SOURCES, type SpendSource } from "./spend-law";
import {
  readResearchUsageSince,
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
}

export interface SpendWindow {
  since: string;
  /** Sum of the RECORDED sources only. */
  totalUsd: number;
  /** Always one row per source, in SPEND_SOURCES order. */
  sources: SpendWindowSource[];
  unrecordedResearchRuns: number;
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
  };
}

/** An answer for a window nothing could be read from. */
export function emptyWindow(since: string): SpendWindow {
  return {
    since,
    totalUsd: 0,
    sources: SPEND_SOURCES.map((s) => emptySource(s, true)),
    unrecordedResearchRuns: 0,
  };
}

/** Fold the priced-run rows into their source totals. */
function foldUsage(rows: SpendUsageRow[]): Record<"agent" | "composer" | "story", SpendWindowSource> {
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
    // never read as free.
    target.costUsd = (target.costUsd ?? 0) + estimateCost(row.model, input, output);
  }

  return acc;
}

/**
 * Deep Research, folded the same way, plus a count of the runs whose usage was
 * NEVER recorded. That second number is why this cannot just call foldUsage.
 */
function foldResearch(rows: ResearchUsageRow[]): { row: SpendWindowSource; unrecorded: number } {
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
    row.costUsd = (row.costUsd ?? 0) + estimateCost(r.model, input, output);
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
  const folded = foldUsage(readRunUsageSince(since));
  const research = foldResearch(readResearchUsageSince(since));

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
  };
}
