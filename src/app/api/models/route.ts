// ═══════════════════════════════════════════════════════════════
// /api/models — list + create
// ═══════════════════════════════════════════════════════════════
//
// SQLite-backed registry. Replaces /api/config/model (deleted in PR 4).
// API key is never returned in any GET response.
import { NextRequest, NextResponse } from "next/server";

import { listModels, createModel, deleteModel } from "@/lib/models-repository";
import { logApiError } from "@/lib/api-logger";
import { requireAuth } from "@/lib/api-auth";
import { parseJsonBody } from "@/lib/parse-json-body";
import { appendAuditLine } from "@/lib/audit-log";
import { zodErrorResponse, modelPostSchema } from "@/lib/api-schemas";
import { serverError } from "@/lib/api-response";
import { syncDefaultsToHermesConfig } from "@/lib/hermes-config-sync";

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

  try {
    return NextResponse.json({ data: { models: listModels() } });
  } catch (error) {
    logApiError("GET /api/models", "listing models", error);
    return serverError("Failed to list models");
  }
}

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

  const bodyResult = await parseJsonBody(request);
  if (bodyResult instanceof NextResponse) return bodyResult;

  const parsed = modelPostSchema.safeParse(bodyResult);
  if (!parsed.success) {
    return zodErrorResponse(parsed.error);
  }

  let createdId: string | null = null;
  try {
    const model = createModel(parsed.data);
    createdId = model.id;
    // Only re-sync config.yaml if this model claims a default slot;
    // otherwise nothing in Hermes config needs to change.
    if (parsed.data.defaults && Object.values(parsed.data.defaults).some(Boolean)) {
      syncDefaultsToHermesConfig();
    }
    appendAuditLine({ action: "model.create", resource: model.id, ok: true });
    return NextResponse.json({ data: { model } }, { status: 201 });
  } catch (error) {
    if (createdId) {
      try {
        deleteModel(createdId);
      } catch (cleanupErr) {
        logApiError("POST /api/models", "rolling back model after sync failure", cleanupErr);
      }
    }
    logApiError("POST /api/models", "creating model", error);
    return serverError("Failed to create model");
  }
}
