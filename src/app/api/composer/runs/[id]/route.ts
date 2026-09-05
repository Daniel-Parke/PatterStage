// ═══════════════════════════════════════════════════════════════
// GET /api/composer/runs/[id] — one run + its node-runs + the workflow graph
// ═══════════════════════════════════════════════════════════════

import { NextRequest } from "next/server";
import { serverErrorFromCatch } from "@/lib/api-logger";
import { ok, notFound, serviceUnavailable } from "@/lib/api-response";
import { isFeatureEnabled } from "@/lib/feature-flags";
import {
  getComposerRun,
  getWorkflowGraph,
  listComposerApprovals,
  listNodeRuns,
} from "@/lib/composer/composer-repository";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, ctx: Ctx) {
  if (!isFeatureEnabled("composer")) {
    return serviceUnavailable("Composer is not enabled. Set PS_COMPOSER=1 to enable workflows.");
  }
  const { id } = await ctx.params;
  try {
    const run = getComposerRun(id);
    if (!run) return notFound("Composer run not found");
    // The gate decisions travel with the run. They were recorded, kept, and
    // shown to nobody (T-0106, D8).
    return ok({
      run,
      nodeRuns: listNodeRuns(id),
      graph: getWorkflowGraph(run.workflowId),
      approvals: listComposerApprovals(id),
    });
  } catch (error) {
    return serverErrorFromCatch("GET /api/composer/runs/[id]", `id=${id}`, error, "Failed to load run");
  }
}
