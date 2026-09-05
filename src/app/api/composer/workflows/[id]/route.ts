// ═══════════════════════════════════════════════════════════════
// /api/composer/workflows/[id] — read / replace / delete one workflow
//
// GET    — the full graph (nodes + edges) for the builder.
// PUT    — replace the whole graph atomically (the builder's save).
// DELETE — remove the workflow.
// Edits are blocked while the workflow has active runs (would orphan a run's
// current node). Gated by the `composer` flag + auth for mutations.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";

import { serverErrorFromCatch } from "@/lib/api-logger";
import { ok, badRequest, notFound, serviceUnavailable } from "@/lib/api-response";
import { ensureDb } from "@/lib/db";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { parseAndValidateJsonBody } from "@/lib/parse-json-body";
import {
  WorkflowHistoryWouldBeLost,
  deleteWorkflow,
  getWorkflowGraph,
  replaceWorkflowGraph,
  workflowHasActiveRuns,
} from "@/lib/composer/composer-repository";
import { workflowDefSchema } from "@/lib/composer/schema";
import { recordEvent } from "@/lib/analytics/record-event";

interface Ctx {
  params: Promise<{ id: string }>;
}

const ACTIVE_EDIT_MSG = "Cannot change a workflow with active runs — let them finish or cancel them first.";

export async function GET(_request: NextRequest, ctx: Ctx) {
  if (!isFeatureEnabled("composer")) {
    return serviceUnavailable("Composer is not enabled. Set PS_COMPOSER=1 to enable workflows.");
  }
  const { id } = await ctx.params;
  try {
    ensureDb();
    const graph = getWorkflowGraph(id);
    if (!graph) return notFound("Workflow not found");
    return ok({ workflow: graph });
  } catch (error) {
    return serverErrorFromCatch("GET /api/composer/workflows/[id]", `id=${id}`, error, "Failed to load workflow");
  }
}

export async function PUT(request: NextRequest, ctx: Ctx) {
  if (!isFeatureEnabled("composer")) {
    return serviceUnavailable("Composer is not enabled. Set PS_COMPOSER=1 to enable workflows.");
  }
  const { id } = await ctx.params;

  const parsed = await parseAndValidateJsonBody(request, workflowDefSchema);
  if (parsed instanceof NextResponse) return parsed;

  // Structural saves destroy completed run history (node-runs reference nodes
  // with no cascade). The repository refuses unless the caller has said so.
  const discardRunHistory = request.nextUrl.searchParams.get("discardRunHistory") === "1";

  try {
    ensureDb();
    if (!getWorkflowGraph(id)) return notFound("Workflow not found");
    if (workflowHasActiveRuns(id)) return badRequest(ACTIVE_EDIT_MSG);
    const workflow = replaceWorkflowGraph(id, parsed, { discardRunHistory });
    recordEvent("composer.workflow_saved", { entityType: "workflow", entityId: id, metadata: { action: "replaced" } });
    return ok({ workflow });
  } catch (error) {
    if (error instanceof WorkflowHistoryWouldBeLost) {
      // 409: the client can resolve this by confirming, so it is not a 400.
      return NextResponse.json(
        {
          error: error.message,
          runCount: error.runCount,
          confirmWith: "?discardRunHistory=1",
        },
        { status: 409 },
      );
    }
    return serverErrorFromCatch("PUT /api/composer/workflows/[id]", `id=${id}`, error, "Failed to save workflow");
  }
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  if (!isFeatureEnabled("composer")) {
    return serviceUnavailable("Composer is not enabled. Set PS_COMPOSER=1 to enable workflows.");
  }
  const { id } = await ctx.params;
  try {
    ensureDb();
    if (!getWorkflowGraph(id)) return notFound("Workflow not found");
    if (workflowHasActiveRuns(id)) return badRequest(ACTIVE_EDIT_MSG);
    deleteWorkflow(id);
    return ok({ deleted: true });
  } catch (error) {
    return serverErrorFromCatch("DELETE /api/composer/workflows/[id]", `id=${id}`, error, "Failed to delete workflow");
  }
}
