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
import { insertResearchStep, updateResearchRun } from "./research-repository";
import { captureArtifactOnce } from "@/lib/artifacts-repository";
import type { ResearchConfig } from "./types";

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
    const searchDown = result.searchAttempts > 0 && result.searchFailures === result.searchAttempts;
    updateResearchRun(runId, {
      status: searchDown ? "failed" : "completed",
      report: result.report,
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
    logApiError("deep-research.runResearchJob", runId, err);
    // No `usage` here, deliberately. The engine threw before it could return a
    // total, so the tokens this run burned are genuinely unknown, and NULL is
    // the honest record of that. Writing 0 would report a crashed run as free.
    updateResearchRun(runId, {
      status: "failed",
      error: messageFromError(err, "research failed"),
      completedAt: now(),
    });
  }
}
