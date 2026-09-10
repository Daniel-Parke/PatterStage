// ═══════════════════════════════════════════════════════════════
// GET /api/composer/runs/[id] — one run + its node-runs + the workflow graph
// ═══════════════════════════════════════════════════════════════

import { NextRequest } from "next/server";
import { ok, notFound, serviceUnavailable } from "@/lib/api/api-response";
import { isFeatureEnabled } from "@/lib/feature-flags";
import {
  getComposerRun,
  getWorkflowGraph,
  listComposerApprovals,
  listNodeRuns,
} from "@/lib/composer/composer-repository";
import { route } from "@/lib/api/api-route";

interface Ctx {
  params: Promise<{ id: string }>;
}

export const GET = route("GET /api/composer/runs/[id]", (p) => `id=${p.id}`, "Failed to load run", async (_request: NextRequest, ctx: Ctx) => {
  if (!isFeatureEnabled("composer")) {
    return serviceUnavailable("Composer is not enabled. Set PS_COMPOSER=1 to enable workflows.");
  }
  const { id } = await ctx.params;
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
});
