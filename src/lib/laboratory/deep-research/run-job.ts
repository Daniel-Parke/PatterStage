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
    updateResearchRun(runId, {
      status: "completed",
      report: result.report,
      provider: result.provider,
      completedAt: now(),
    });
  } catch (err) {
    logApiError("deep-research.runResearchJob", runId, err);
    updateResearchRun(runId, {
      status: "failed",
      error: messageFromError(err, "research failed"),
      completedAt: now(),
    });
  }
}
