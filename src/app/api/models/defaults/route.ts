// ═══════════════════════════════════════════════════════════════
// /api/models/defaults — read & write the 11 task-slot defaults
// Hermes-only; no framework scoping needed.
// ═══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";

import { getModelDefaults, setDefaultModel } from "@/lib/models-repository";
import { serverErrorFromCatch } from "@/lib/api-logger";
import { requireAuth } from "@/lib/api-auth";
import { parseJsonBody } from "@/lib/parse-json-body";
import { appendAuditLine } from "@/lib/audit-log";
import { zodErrorResponse, setDefaultPutSchema } from "@/lib/api-schemas";
import { notFound } from "@/lib/api-response";
import { syncDefaultsToHermesConfig } from "@/lib/hermes-config-sync";

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

  try {
    return NextResponse.json({ data: { defaults: getModelDefaults() } });
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
  const auth = requireAuth(request);
  if (auth) return auth;

  const bodyResult = await parseJsonBody(request);
  if (bodyResult instanceof NextResponse) return bodyResult;

  const parsed = setDefaultPutSchema.safeParse(bodyResult);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  try {
    // setDefaultPutSchema narrows parsed.data.taskType to TaskType, so no
    // cast is needed. (Session 53 dropped the z.enum widening cast on
    // taskTypeSchema.)
    const defaults = setDefaultModel(parsed.data.taskType, parsed.data.modelId);
    syncDefaultsToHermesConfig();
    appendAuditLine({
      action: "model.default.set",
      resource: `${parsed.data.taskType}=${parsed.data.modelId ?? "null"}`,
      ok: true,
    });
    return NextResponse.json({ data: { defaults } });
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
