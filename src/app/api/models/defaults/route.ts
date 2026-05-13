// ═══════════════════════════════════════════════════════════════
// /api/models/defaults — read & write the 11 task-slot defaults
// Hermes-only; no framework scoping needed.
// ═══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";

import { getModelDefaults, setDefaultModel } from "@/lib/models-repository";
import { logApiError } from "@/lib/api-logger";
import { requireMcApiKey, requireNotReadOnly } from "@/lib/api-auth";
import { appendAuditLine } from "@/lib/audit-log";
import { zodErrorResponse, setDefaultPutSchema } from "@/lib/api-schemas";
import type { TaskType } from "@/lib/hermes-providers";
import { syncDefaultsToHermesConfig } from "@/lib/hermes-config-sync";

export async function GET(_request: NextRequest) {
  try {
    return NextResponse.json({ data: { defaults: getModelDefaults() } });
  } catch (error) {
    logApiError("GET /api/models/defaults", "reading defaults", error);
    return NextResponse.json({ error: "Failed to read defaults" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const ro = requireNotReadOnly();
  if (ro) return ro;
  const auth = requireMcApiKey(request);
  if (auth) return auth;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = setDefaultPutSchema.safeParse(raw);
  if (!parsed.success) return zodErrorResponse(parsed.error);



  try {
    const defaults = setDefaultModel(parsed.data.taskType as TaskType, parsed.data.modelId);
    syncDefaultsToHermesConfig();
    appendAuditLine({
      action: "model.default.set",
      resource: `${parsed.data.taskType}=${parsed.data.modelId ?? "null"}`,
      ok: true,
    });
    return NextResponse.json({ data: { defaults } });
  } catch (error) {
    if (error instanceof Error && /Model not found/.test(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    logApiError("PUT /api/models/defaults", "setting default", error);
    return NextResponse.json({ error: "Failed to set default" }, { status: 500 });
  }
}
