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
import { requireAuth } from "@/lib/api-auth";
import { serverErrorFromCatch } from "@/lib/api-logger";
import { ok, badRequest, notFound, serviceUnavailable } from "@/lib/api-response";
import { ensureDb } from "@/lib/db";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { parseAndValidateJsonBody } from "@/lib/parse-json-body";
import {
  deleteWorkflow,
  getWorkflowGraph,
  replaceWorkflowGraph,
  workflowHasActiveRuns,
} from "@/lib/composer/composer-repository";
import { workflowDefSchema } from "@/lib/composer/schema";

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
  const auth = requireAuth(request);
  if (auth) return auth;
  if (!isFeatureEnabled("composer")) {
    return serviceUnavailable("Composer is not enabled. Set PS_COMPOSER=1 to enable workflows.");
  }
  const { id } = await ctx.params;

  const parsed = await parseAndValidateJsonBody(request, workflowDefSchema);
  if (parsed instanceof NextResponse) return parsed;

  try {
    ensureDb();
    if (!getWorkflowGraph(id)) return notFound("Workflow not found");
    if (workflowHasActiveRuns(id)) return badRequest(ACTIVE_EDIT_MSG);
    const workflow = replaceWorkflowGraph(id, parsed);
    return ok({ workflow });
  } catch (error) {
    return serverErrorFromCatch("PUT /api/composer/workflows/[id]", `id=${id}`, error, "Failed to save workflow");
  }
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const auth = requireAuth(request);
  if (auth) return auth;
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
