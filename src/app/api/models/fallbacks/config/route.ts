// ═══════════════════════════════════════════════════════════════
// /api/models/fallbacks/config — GET/PUT fallback behaviour config
// ═══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { parseJsonBody } from "@/lib/parse-json-body";
import { logApiError } from "@/lib/api-logger";
import { appendAuditLine } from "@/lib/audit-log";
import { fallbackConfigPutSchema } from "@/lib/fallback-config-schema";
import { getFallbackConfig, updateFallbackConfigBatch } from "@/lib/fallbacks-repository";
import { syncEnabledFallbackChainToHermes } from "@/lib/fallback-sync-helpers";
import { zodErrorResponse } from "@/lib/api-schemas";

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

  try {
    return NextResponse.json({ data: { config: getFallbackConfig() } });
  } catch (error) {
    logApiError("GET /api/models/fallbacks/config", "reading config", error);
    return NextResponse.json({ error: "Failed to read fallback config" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

  const bodyResult = await parseJsonBody(request);
  if (bodyResult instanceof NextResponse) return bodyResult;

  const parsed = fallbackConfigPutSchema.safeParse(bodyResult);
  if (!parsed.success) {
    return zodErrorResponse(parsed.error);
  }

  try {
    const updated = updateFallbackConfigBatch(parsed.data);
    syncEnabledFallbackChainToHermes(updated);

    appendAuditLine({ action: "fallback.config.update", resource: "config", ok: true });
    return NextResponse.json({ data: { config: updated } });
  } catch (error) {
    logApiError("PUT /api/models/fallbacks/config", "updating config", error);
    return NextResponse.json({ error: "Failed to update fallback config" }, { status: 500 });
  }
}