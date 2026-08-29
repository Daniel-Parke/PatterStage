// ═══════════════════════════════════════════════════════════════
// POST /api/composer/runs/[id]/nodes/[nodeId]/approve — resolve a HIL gate
//
// Records the gate decision (accept/reject/review/add_feature), resumes the
// run, and advances the workflow graph (the engine routes on_approve/on_reject).
// Gated by the `composer` flag.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { serverErrorFromCatch } from "@/lib/api-logger";
import { ok, badRequest, notFound, serviceUnavailable } from "@/lib/api-response";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { parseAndValidateJsonBody } from "@/lib/parse-json-body";
import {
  getComposerRun,
  getNode,
  recordComposerApproval,
  updateComposerRun,
} from "@/lib/composer/composer-repository";
import { advanceComposerRun } from "@/lib/composer/engine";
import { approvalActionSchema } from "@/lib/composer/schema";

const bodySchema = z.object({ action: approvalActionSchema, note: z.string().optional() }).strict();

interface Ctx {
  params: Promise<{ id: string; nodeId: string }>;
}

export async function POST(request: NextRequest, ctx: Ctx) {
  if (!isFeatureEnabled("composer")) {
    return serviceUnavailable("Composer is not enabled. Set PS_COMPOSER=1 to enable workflows.");
  }

  const { id, nodeId } = await ctx.params;
  const parsed = await parseAndValidateJsonBody(request, bodySchema);
  if (parsed instanceof NextResponse) return parsed;

  try {
    const run = getComposerRun(id);
    if (!run) return notFound("Composer run not found");
    if (run.status !== "awaiting_approval") return badRequest("Run is not awaiting approval");
    if (!getNode(nodeId)) return notFound("Node not found");

    recordComposerApproval({ composerRunId: id, nodeId, action: parsed.action, note: parsed.note ?? null });
    updateComposerRun(id, { status: "running" }); // resume so the engine advances
    await advanceComposerRun(id);
    return ok({ run: getComposerRun(id) });
  } catch (error) {
    return serverErrorFromCatch(
      "POST /api/composer/runs/[id]/nodes/[nodeId]/approve",
      `id=${id}`,
      error,
      "Failed to record approval",
    );
  }
}
