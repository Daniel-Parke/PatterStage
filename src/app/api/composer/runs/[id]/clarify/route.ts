// ═══════════════════════════════════════════════════════════════
// POST /api/composer/runs/[id]/clarify — answer a stage's clarification question
//
// When a stage can't proceed on a too-vague objective it pauses the run
// (awaiting_approval + a `__clarify` context marker, set by the engine). This
// resumes it: the answer enriches the objective, the marker is cleared, and the
// asking stage is re-dispatched with the clarified objective. Gated by the
// `composer` flag.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { serverErrorFromCatch } from "@/lib/api-logger";
import { ok, badRequest, notFound, serviceUnavailable } from "@/lib/api-response";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { parseAndValidateJsonBody } from "@/lib/parse-json-body";
import { getComposerRun, getNode, updateComposerRun } from "@/lib/composer/composer-repository";
import { dispatchComposerNode } from "@/lib/composer/dispatch";

const bodySchema = z.object({ answer: z.string().min(1).max(20_000) }).strict();

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, ctx: Ctx) {
  if (!isFeatureEnabled("composer")) {
    return serviceUnavailable("Composer is not enabled. Set PS_COMPOSER=1 to enable workflows.");
  }

  const { id } = await ctx.params;
  const parsed = await parseAndValidateJsonBody(request, bodySchema);
  if (parsed instanceof NextResponse) return parsed;

  try {
    const run = getComposerRun(id);
    if (!run) return notFound("Composer run not found");
    const clarify = (run.context?.__clarify ?? null) as { nodeId?: string; question?: string } | null;
    if (run.status !== "awaiting_approval" || !clarify?.nodeId) {
      return badRequest("Run is not awaiting clarification");
    }
    const node = getNode(clarify.nodeId);
    if (!node) return notFound("Stage not found");

    // Enrich the objective with the answer; clear the clarification marker.
    const enrichedInput = `${run.input ?? ""}\n\n## Clarification\n${parsed.answer.trim()}`.trim();
    const nextContext = { ...(run.context ?? {}) };
    delete (nextContext as Record<string, unknown>).__clarify;
    updateComposerRun(id, { status: "running", input: enrichedInput, context: nextContext, currentNodeId: node.id });

    // Re-run the asking stage with the clarified objective (a fresh attempt; the
    // per-node attempt cap bounds repeated clarification).
    await dispatchComposerNode(id, node.id);
    return ok({ run: getComposerRun(id) });
  } catch (error) {
    return serverErrorFromCatch("POST /api/composer/runs/[id]/clarify", `id=${id}`, error, "Failed to submit clarification");
  }
}
