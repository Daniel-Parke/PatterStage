// ═══════════════════════════════════════════════════════════════
// /api/composer/workflows — list + create Composer workflow definitions
//
// GET  — list available workflows.
// POST — create a workflow from a full graph definition (the builder's "save
//        as new"). Gated by the `composer` flag + auth.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";

import { serverErrorFromCatch } from "@/lib/api-logger";
import { ok, created, serviceUnavailable } from "@/lib/api-response";
import { ensureDb } from "@/lib/db";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { parseAndValidateJsonBody } from "@/lib/parse-json-body";
import { createWorkflowFromDef, listWorkflows } from "@/lib/composer/composer-repository";
import { workflowDefSchema } from "@/lib/composer/schema";
import { recordEvent } from "@/lib/analytics/record-event";

export async function GET() {
  if (!isFeatureEnabled("composer")) {
    return serviceUnavailable("Composer is not enabled. Set PS_COMPOSER=1 to enable workflows.");
  }
  try {
    ensureDb();
    return ok({ workflows: listWorkflows() });
  } catch (error) {
    return serverErrorFromCatch("GET /api/composer/workflows", "list", error, "Failed to list workflows");
  }
}

export async function POST(request: NextRequest) {
  if (!isFeatureEnabled("composer")) {
    return serviceUnavailable("Composer is not enabled. Set PS_COMPOSER=1 to enable workflows.");
  }

  const parsed = await parseAndValidateJsonBody(request, workflowDefSchema);
  if (parsed instanceof NextResponse) return parsed;

  try {
    ensureDb();
    const workflow = createWorkflowFromDef(parsed);
    recordEvent("composer.workflow_saved", { entityType: "workflow", entityId: workflow.id, metadata: { action: "created" } });
    return created({ workflow });
  } catch (error) {
    return serverErrorFromCatch("POST /api/composer/workflows", "create", error, "Failed to create workflow");
  }
}
