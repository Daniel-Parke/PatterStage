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

import { ok, badRequest, notFound } from "@/lib/api/api-response";
import { composerOff } from "@/lib/feature-flags-guard";
import { parseAndValidateJsonBody } from "@/lib/api/parse-json-body";
import { getComposerRun, getNode, updateComposerRun } from "@/lib/composer/composer-repository";
import { dispatchComposerNode } from "@/lib/composer/dispatch";
import { route, type RouteContext } from "@/lib/api/api-route";

const bodySchema = z.object({ answer: z.string().min(1).max(20_000) }).strict();

type Ctx = RouteContext<{ id: string }>;

export const POST = route("POST /api/composer/runs/[id]/clarify", (p) => `id=${p.id}`, "Failed to submit clarification", async (request: NextRequest, ctx: Ctx) => {
  const unavailable = composerOff();
  if (unavailable) return unavailable;

  const { id } = await ctx.params;
  const parsed = await parseAndValidateJsonBody(request, bodySchema);
  if (parsed instanceof NextResponse) return parsed;
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
});
