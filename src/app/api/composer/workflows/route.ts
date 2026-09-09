// ═══════════════════════════════════════════════════════════════
// /api/composer/workflows — list + create Composer workflow definitions
//
// GET  — list available workflows.
// POST — create a workflow from a full graph definition (the builder's "save
//        as new"). Gated by the `composer` flag + auth.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";

import { ok, created, serviceUnavailable } from "@/lib/api-response";
import { ensureDb } from "@/lib/db";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { parseAndValidateJsonBody } from "@/lib/parse-json-body";
import { createWorkflowFromDef, listWorkflows } from "@/lib/composer/composer-repository";
import { workflowDefSchema } from "@/lib/composer/schema";
import { recordEvent } from "@/lib/analytics/record-event";
import { route } from "@/lib/api-route";

export const GET = route("GET /api/composer/workflows", "list", "Failed to list workflows", async () => {
  if (!isFeatureEnabled("composer")) {
    return serviceUnavailable("Composer is not enabled. Set PS_COMPOSER=1 to enable workflows.");
  }
  ensureDb();
  return ok({ workflows: listWorkflows() });
});

export const POST = route("POST /api/composer/workflows", "create", "Failed to create workflow", async (request: NextRequest) => {
  if (!isFeatureEnabled("composer")) {
    return serviceUnavailable("Composer is not enabled. Set PS_COMPOSER=1 to enable workflows.");
  }

  const parsed = await parseAndValidateJsonBody(request, workflowDefSchema);
  if (parsed instanceof NextResponse) return parsed;
  ensureDb();
  const workflow = createWorkflowFromDef(parsed);
  recordEvent("composer.workflow_saved", { entityType: "workflow", entityId: workflow.id, metadata: { action: "created" } });
  return created({ workflow });
});
