// ═══════════════════════════════════════════════════════════════
// /api/composer/runs — list + start Composer workflow runs
//
// GET  — recent runs.
// POST — start a run from a workflow (by id or key) + an input; kicks the
//        engine so the first stage dispatches immediately. The page then
//        streams progress (SSE) / polls. Gated by the `composer` flag.
// ═══════════════════════════════════════════════════════════════

import { boundsFrom } from "@/lib/list-bounds";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { serverErrorFromCatch } from "@/lib/api-logger";
import { ok, created, badRequest, serviceUnavailable } from "@/lib/api-response";
import { ensureDb } from "@/lib/db";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { parseAndValidateJsonBody } from "@/lib/parse-json-body";
import {
  createComposerRun,
  getWorkflow,
  getWorkflowByKey,
  listComposerRuns,
} from "@/lib/composer/composer-repository";
import { advanceComposerRun } from "@/lib/composer/engine";
import { recordEvent } from "@/lib/analytics/record-event";

const startSchema = z
  .object({
    workflowId: z.string().min(1).optional(),
    workflowKey: z.string().min(1).optional(),
    input: z.string().min(3).max(20000),
    profileName: z.string().min(1).optional(),
  })
  .strict()
  .refine((v) => v.workflowId || v.workflowKey, { message: "workflowId or workflowKey is required" });

export async function GET(request?: NextRequest) {
  if (!isFeatureEnabled("composer")) {
    return serviceUnavailable("Composer is not enabled. Set PS_COMPOSER=1 to enable workflows.");
  }
  try {
    ensureDb();
    return ok({ runs: listComposerRuns(boundsFrom(request, { defaultLimit: 50, maxLimit: 500 }).limit) });
  } catch (error) {
    return serverErrorFromCatch("GET /api/composer/runs", "list", error, "Failed to list runs");
  }
}

export async function POST(request: NextRequest) {
  if (!isFeatureEnabled("composer")) {
    return serviceUnavailable("Composer is not enabled. Set PS_COMPOSER=1 to enable workflows.");
  }

  const parsed = await parseAndValidateJsonBody(request, startSchema);
  if (parsed instanceof NextResponse) return parsed;

  try {
    ensureDb();
    const workflow = parsed.workflowId
      ? getWorkflow(parsed.workflowId)
      : getWorkflowByKey(parsed.workflowKey!);
    if (!workflow) return badRequest("Unknown workflow");

    const run = createComposerRun({
      workflowId: workflow.id,
      input: parsed.input,
      profileName: parsed.profileName ?? null,
    });
    recordEvent("composer.run_started", {
      entityType: "composer_run",
      entityId: run.id,
      profile: parsed.profileName ?? null,
      metadata: { workflowId: workflow.id },
    });
    // Kick the engine so the first stage dispatches now (the tick is the backstop).
    void advanceComposerRun(run.id);
    return created({ run });
  } catch (error) {
    return serverErrorFromCatch("POST /api/composer/runs", "start", error, "Failed to start run");
  }
}
