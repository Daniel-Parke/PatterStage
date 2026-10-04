// ═══════════════════════════════════════════════════════════════
// /api/composer/workflows — list + create Composer workflow definitions
//
// GET  — list available workflows.
// POST — create a workflow from a full graph definition (the builder's "save
//        as new"). Gated by the `composer` flag + auth.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";

import { ok, created } from "@/lib/api/api-response";
import { ensureDb } from "@/lib/db";
import { composerOff } from "@/lib/feature-flags-guard";
import { parseAndValidateJsonBody } from "@/lib/api/parse-json-body";
import { createWorkflowFromDef, listWorkflows } from "@/lib/composer/composer-repository";
import { workflowDefSchema } from "@/lib/composer/schema";
import { recordEvent } from "@/lib/analytics/record-event";
import { route } from "@/lib/api/api-route";

export const GET = route("GET /api/composer/workflows", "list", "Failed to list workflows", async () => {
  const unavailable = composerOff();
  if (unavailable) return unavailable;
  ensureDb();
  return ok({ workflows: listWorkflows() });
});

export const POST = route("POST /api/composer/workflows", "create", "Failed to create workflow", async (request: NextRequest) => {
  const unavailable = composerOff();
  if (unavailable) return unavailable;

  const parsed = await parseAndValidateJsonBody(request, workflowDefSchema);
  if (parsed instanceof NextResponse) return parsed;
  ensureDb();
  const workflow = createWorkflowFromDef(parsed);
  recordEvent("composer.workflow_saved", { entityType: "workflow", entityId: workflow.id, metadata: { action: "created" } });
  return created({ workflow });
});
