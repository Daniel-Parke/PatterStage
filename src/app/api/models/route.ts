// ═══════════════════════════════════════════════════════════════
// /api/models — list + create
// ═══════════════════════════════════════════════════════════════
//
// SQLite-backed registry. Replaces /api/config/model (deleted in PR 4).
// API key is never returned in any GET response.
import { NextRequest, NextResponse } from "next/server";

import { listModels, createModel, deleteModel } from "@/lib/models-repository";
import { boundsFrom, MODEL_LIST_BOUNDS } from "@/lib/list-bounds";
import { logApiError, serverErrorFromCatch } from "@/lib/api-logger";

import { parseAndValidateJsonBody } from "@/lib/parse-json-body";
import { appendAuditLine } from "@/lib/audit-log";
import { modelPostSchema } from "@/lib/api-schemas";
import { created, ok } from "@/lib/api-response";
import { syncDefaultsToHermesConfig } from "@/modules/hermes/lib/config-sync";
import { recordEvent } from "@/lib/analytics/record-event";

export async function GET(request?: NextRequest) {
  try {
    return ok({ models: listModels({ limit: boundsFrom(request, MODEL_LIST_BOUNDS).limit }) });
  } catch (error) {
    return serverErrorFromCatch(
      "GET /api/models",
      "listing models",
      error,
      "Failed to list models",
    );
  }
}

export async function POST(request: NextRequest) {
  const parsed = await parseAndValidateJsonBody(request, modelPostSchema);
  if (parsed instanceof NextResponse) return parsed;

  let createdId: string | null = null;
  try {
    const model = createModel(parsed);
    createdId = model.id;
    // Only re-sync config.yaml if this model claims a default slot;
    // otherwise nothing in Hermes config needs to change.
    if (parsed.defaults && Object.values(parsed.defaults).some(Boolean)) {
      syncDefaultsToHermesConfig();
    }
    appendAuditLine({ action: "model.create", resource: model.id, ok: true });
    recordEvent("model.added", { entityType: "model", entityId: model.id, metadata: { provider: model.provider } });
    return created({ model });
  } catch (error) {
    if (createdId) {
      try {
        deleteModel(createdId);
      } catch (cleanupErr) {
        logApiError("POST /api/models", "rolling back model after sync failure", cleanupErr);
      }
    }
    return serverErrorFromCatch(
      "POST /api/models",
      "creating model",
      error,
      "Failed to create model",
    );
  }
}
