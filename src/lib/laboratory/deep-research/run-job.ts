// ═══════════════════════════════════════════════════════════════
// laboratory/deep-research/run-job.ts — run the engine + persist progress
//
// Glue between the engine (pure orchestrator) and the repository: drives a
// research run from pending → terminal, persisting each step as it lands and
// stamping the final report. Kicked off async by the POST route (fire-and-
// forget, like the mission queue tick) — the page polls for progress.
// ═══════════════════════════════════════════════════════════════

import { now } from "@/lib/db";
import { logApiError } from "@/lib/api-logger";
import { messageFromError } from "@/lib/api-fetch";
import { runDeepResearch, defaultLlm, defaultVisit } from "./engine";
import { resolveSearchProvider } from "./search";
import { getResearchRun, insertResearchStep, updateResearchRun } from "./research-repository";
import { captureArtifactOnce } from "@/lib/artifacts-repository";
import { recordEvent } from "@/lib/analytics/record-event";
import type { ResearchConfig } from "./types";

/**
 * Prepend an honest note to a report the run could not fully gather the evidence
 * for.
 *
 * The engine counted its search and visit failures and the caller read them for
 * exactly ONE case: EVERY search failed, which fails the run outright. Five out
 * of eight was invisible -- a report written from three sources instead of
 * eight, marked `completed`, reading exactly like a healthy one (T-0070).
 *
 * The note goes in the REPORT rather than only in a column because the report is
 * what gets read, exported and captured as an artifact. A number in a table
 * nobody opens does not stop a confident-sounding paragraph being believed.
 *
 * A clean gather gets nothing added. The caveat has to stay rare to mean
 * anything, and a banner on every run is a banner nobody reads.
 */
export function withGatherCaveat(
  report: string,
  counts: {
    searchAttempts: number;
    searchFailures: number;
    visitAttempts: number;
    visitFailures: number;
  },
): string {
  const parts: string[] = [];
  if (counts.searchFailures > 0) {
    parts.push(
      `${counts.searchFailures} of ${counts.searchAttempts} searches failed`,
    );
  }
  if (counts.visitFailures > 0) {
    parts.push(
      `${counts.visitFailures} of ${counts.visitAttempts} pages could not be read`,
    );
  }
  if (parts.length === 0) return report;
  return (
    `> **Incomplete evidence.** ${parts.join(", and ")}. ` +
    `This report was written from less than it set out to gather, so treat its ` +
    `coverage as partial.\n\n${report}`
  );
}

/**
 * Thrown by the step hook when the operator cancelled the run mid-flight.
 *
 * Not exported: nothing outside this file should be able to fake a cancel, and
 * the catch below is the only place that reads it.
 */
class ResearchCancelled extends Error {}

/** True when the row says the operator stopped this run. */
function wasCancelled(runId: string): boolean {
  return getResearchRun(runId)?.status === "cancelled";
}

export async function runResearchJob(
  runId: string,
  query: string,
  config?: ResearchConfig | null,
): Promise<void> {
  updateResearchRun(runId, { status: "running" });
  let position = 0;
  try {
    const result = await runDeepResearch(query, {
      llm: defaultLlm,
      search: resolveSearchProvider(config?.searchProvider),
      visit: defaultVisit,
      modelId: config?.modelId ?? undefined,
      maxRounds: config?.rounds,
      resultsPerQuery: config?.resultsPerQuery,
      visitsPerRound: config?.visitsPerRound,
      onStep: (step) => {
        // Checked BEFORE the insert: a cancelled run collects no further steps,
        // and the throw is what actually stops the engine — the row alone would
        // just be overwritten by the terminal write below (T-0108, D98).
        if (wasCancelled(runId)) throw new ResearchCancelled();
        insertResearchStep({
          runId,
          position: position++,
          kind: step.kind,
          input: step.input,
          output: step.output,
          sources: step.sources,
        });
      },
    });
    // Honest failure, borrowed from the benchmark runner's stance that a run
    // where everything errored is a FAILED run, not a low score. Every search
    // throwing collapsed to zero sources, the synthesis prompt fell back to
    // "answer from model knowledge", and this line then marked it `completed` --
    // so a total search outage shipped a confident, cited-looking report that an
    // operator could not tell from a real one.
    //
    // Zero results is NOT this case: a search that legitimately found nothing
    // still completes, and the report says so.
    // A run cancelled during the final synthesize fires no further step hook,
    // so this is the last place left to notice before `completed` is written.
    if (wasCancelled(runId)) return;
    const searchDown = result.searchAttempts > 0 && result.searchFailures === result.searchAttempts;
    updateResearchRun(runId, {
      status: searchDown ? "failed" : "completed",
      report: searchDown ? result.report : withGatherCaveat(result.report, result),
      provider: result.provider,
      ...(searchDown
        ? {
            error:
              `Search provider unavailable: all ${result.searchAttempts} search ` +
              `attempt(s) failed. The report below was written without any external ` +
              `sources, so its claims are ungrounded.`,
          }
        : {}),
      completedAt: now(),
      // Persisted on BOTH outcomes of this branch, the search-down failure
      // included, because a run that failed still burned the tokens it burned.
      // Excluding failures would under-count spend in exactly the situation
      // that produces the most retries (T-0030).
      usage: result.usage,
      // Likewise on both. The counters were computed and discarded, so anything
      // short of a TOTAL outage left no record that the gather was degraded
      // (T-0070).
      gather: {
        searchAttempts: result.searchAttempts,
        searchFailures: result.searchFailures,
        visitAttempts: result.visitAttempts,
        visitFailures: result.visitFailures,
      },
    });
    // After the terminal row, never before it: a write that throws leaves no
    // event claiming an outcome the table does not hold (T-0098).
    recordEvent(searchDown ? "research.failed" : "research.completed", {
      entityType: "research",
      entityId: runId,
      ...(searchDown ? { metadata: { reason: "search-unavailable" } } : {}),
    });
    // Capture the report as an artifact (idempotent; best-effort — never fail
    // the run on a capture error).
    try {
      captureArtifactOnce({
        sourceKind: "research",
        sourceRunId: runId,
        name: query.trim().length > 80 ? `${query.trim().slice(0, 80)}…` : query.trim() || "Research report",
        description: "Deep Research report",
        mimeType: "text/markdown",
        content: result.report,
        tags: ["report", "research"],
      });
    } catch (capErr) {
      logApiError("deep-research.captureArtifact", runId, capErr);
    }
  } catch (err) {
    // A cancel is not a failure. The row the route wrote is the final word: no
    // terminal update, no `research.failed`, no artifact from a half-run.
    if (err instanceof ResearchCancelled) return;
    logApiError("deep-research.runResearchJob", runId, err);
    // No `usage` here, deliberately. The engine threw before it could return a
    // total, so the tokens this run burned are genuinely unknown, and NULL is
    // the honest record of that. Writing 0 would report a crashed run as free.
    updateResearchRun(runId, {
      status: "failed",
      error: messageFromError(err, "research failed"),
      completedAt: now(),
    });
    recordEvent("research.failed", { entityType: "research", entityId: runId, metadata: { reason: "error" } });
  }
}
