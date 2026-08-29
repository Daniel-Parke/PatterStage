// ═══════════════════════════════════════════════════════════════
// /api/models/defaults — read & write the 11 task-slot defaults
// Hermes-only; no framework scoping needed.
// ═══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";

import { getDefaultModel, getModelDefaults, setDefaultModel } from "@/lib/models-repository";
import { serverErrorFromCatch } from "@/lib/api-logger";

import { parseAndValidateJsonBody } from "@/lib/parse-json-body";
import { appendAuditLine } from "@/lib/audit-log";
import { setDefaultPutSchema } from "@/lib/api-schemas";
import { notFound, ok } from "@/lib/api-response";
import { syncDefaultsToHermesConfig } from "@/modules/hermes/lib/config-sync";
import { recordEvent } from "@/lib/analytics/record-event";

export async function GET(_request: NextRequest) {
  try {
    // `defaults` carries registry UUIDs (the Models UI needs them to know which
    // model each slot points at). `agentModelLabel` is the RESOLVED display name
    // for the agent slot, so the dashboard subtitle shows "MiniMax-M3", not a uuid.
    const agentDefault = getDefaultModel("agent");
    return ok({
      defaults: getModelDefaults(),
      agentModelLabel: agentDefault ? (agentDefault.name || agentDefault.modelId) : null,
    });
  } catch (error) {
    return serverErrorFromCatch(
      "GET /api/models/defaults",
      "reading defaults",
      error,
      "Failed to read defaults",
    );
  }
}

export async function PUT(request: NextRequest) {
  const parsed = await parseAndValidateJsonBody(request, setDefaultPutSchema);
  if (parsed instanceof NextResponse) return parsed;

  try {
    // setDefaultPutSchema narrows parsed.taskType to TaskType, so no
    // cast is needed. (Session 53 dropped the z.enum widening cast on
    // taskTypeSchema.)
    const defaults = setDefaultModel(parsed.taskType, parsed.modelId);
    syncDefaultsToHermesConfig();
    appendAuditLine({
      action: "model.default.set",
      resource: `${parsed.taskType}=${parsed.modelId ?? "null"}`,
      ok: true,
    });
    recordEvent("model.configured", {
      entityType: "model",
      entityId: parsed.modelId ?? parsed.taskType,
      metadata: { taskType: parsed.taskType },
    });
    return ok({ defaults });
  } catch (error) {
    if (error instanceof Error && /Model not found/.test(error.message)) {
      return notFound(error.message);
    }
    return serverErrorFromCatch(
      "PUT /api/models/defaults",
      "setting default",
      error,
      "Failed to set default",
    );
  }
}
