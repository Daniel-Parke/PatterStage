// ═══════════════════════════════════════════════════════════════
// GET /api/composer/runs/[id] — one run + its node-runs + the workflow graph
// ═══════════════════════════════════════════════════════════════

import { NextRequest } from "next/server";
import { ok, notFound } from "@/lib/api/api-response";
import { composerOff } from "@/lib/feature-flags-guard";
import {
  getComposerRun,
  getWorkflowGraph,
  listComposerApprovals,
  listNodeRuns,
} from "@/lib/composer/composer-repository";
import { route, type RouteContext } from "@/lib/api/api-route";

type Ctx = RouteContext<{ id: string }>;

export const GET = route("GET /api/composer/runs/[id]", (p) => `id=${p.id}`, "Failed to load run", async (_request: NextRequest, ctx: Ctx) => {
  const unavailable = composerOff();
  if (unavailable) return unavailable;
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
