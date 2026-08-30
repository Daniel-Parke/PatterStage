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

/**
 * Explain the state we are refusing FROM.
 *
 * The guard used to answer a bare "Run is not awaiting approval" while
 * `run.status` and `run.error` were both in scope -- and `run.error` is where
 * the engine's `describeStageFailure` already put the sentence the operator
 * needs ("Gate A was rejected and the workflow has no recovery path from
 * here"). The message existed and was thrown away one line from where it was
 * wanted (T-0069).
 *
 * This is a real race, not a hypothetical: the gate panel renders from a polled
 * copy, so a run that ended between the poll and the click leaves the Accept and
 * Reject buttons on screen. The operator's click then has to explain that the
 * decision has already been made.
 */
function describeNotAwaiting(run: { status: string; error: string | null }): string {
  const because = run.error ? ` ${run.error}` : "";
  if (run.status === "rejected") {
    return `This gate was already rejected, so there is nothing left to decide.${because}`;
  }
  if (run.status === "failed") {
    return `This run has already failed, so the gate can no longer be decided.${because}`;
  }
  if (run.status === "completed") {
    return "This run has already completed, so the gate can no longer be decided.";
  }
  if (run.status === "cancelled") {
    return "This run was cancelled, so the gate can no longer be decided.";
  }
  // pending / running: the gate is genuinely not open yet, which usually means
  // a stale panel or a double-click that beat the refresh.
  return `This run is ${run.status}, not waiting at a gate. Reload to see where it is now.`;
}

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
    if (run.status !== "awaiting_approval") return badRequest(describeNotAwaiting(run));
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
