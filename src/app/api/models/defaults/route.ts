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
import { finalizeRootConfigOnDisk } from "@/modules/hermes/lib/config-sync";
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
    // Through finalize, not the bare sync: it refreshes agent_root.config_yaml
    // as well, so the next agent-root Push cannot reinstate a primary this
    // request just cleared from a stale copy of the file (T-0100, D9).
    const result = finalizeRootConfigOnDisk(
      parsed.modelId === null ? { cleared: [parsed.taskType] } : {},
    );
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
    // 200, not a 500: the database change IS saved. A refused yaml write is
    // reported beside it rather than hidden behind a success (T-0095, D19).
    return ok({ defaults, error: result.error ?? null });
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
