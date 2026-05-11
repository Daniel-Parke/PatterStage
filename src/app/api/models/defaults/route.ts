// ═══════════════════════════════════════════════════════════════
// /api/models/defaults — read & write the 12 task-slot defaults
// Supports optional ?framework= query param; defaults to "*"
// ═══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";

import { getModelDefaults, setDefaultModel } from "@/lib/models-repository";
import { logApiError } from "@/lib/api-logger";
import { requireMcApiKey, requireNotReadOnly } from "@/lib/api-auth";
import { appendAuditLine } from "@/lib/audit-log";
import { zodErrorResponse, setDefaultPutSchema } from "@/lib/api-schemas";
import type { TaskType } from "@/lib/hermes-providers";
import { syncDefaultsToHermesConfig } from "@/lib/hermes-config-sync";

export async function GET(request: NextRequest) {
  const framework = request.nextUrl.searchParams.get("framework") ?? "*";
  try {
    return NextResponse.json({ data: { defaults: getModelDefaults(framework) } });
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

  // Support framework in body; default to universal
  const framework = (raw as Record<string, unknown>)?.framework as string | undefined ?? "*";

  try {
    const defaults = setDefaultModel(parsed.data.taskType as TaskType, parsed.data.modelId, framework);
    syncDefaultsToHermesConfig();
    appendAuditLine({
      action: "model.default.set",
      resource: `${framework}/${parsed.data.taskType}=${parsed.data.modelId ?? "null"}`,
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
