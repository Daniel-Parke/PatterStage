// ═══════════════════════════════════════════════════════════════
// /api/models/fallbacks/config — GET/PUT fallback behaviour config
// ═══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { parseAndValidateJsonBody } from "@/lib/parse-json-body";
import { serverErrorFromCatch } from "@/lib/api-logger";
import { appendAuditLine } from "@/lib/audit-log";
import { getFallbackConfig, updateFallbackConfigBatch } from "@/lib/fallbacks-repository";
import { fallbackConfigPutSchema } from "@/lib/fallback-config-schema";
import { syncEnabledFallbackChainToHermes } from "@/lib/fallback-sync-helpers";
import { ok } from "@/lib/api-response";

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

  try {
    return ok({ config: getFallbackConfig() });
  } catch (error) {
    return serverErrorFromCatch(
      "GET /api/models/fallbacks/config",
      "reading fallback config",
      error,
      "Failed to read fallback config",
    );
  }
}

export async function PUT(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

  const parsed = await parseAndValidateJsonBody(request, fallbackConfigPutSchema);
  if (parsed instanceof NextResponse) return parsed;

  try {
    const updated = updateFallbackConfigBatch(parsed);
    syncEnabledFallbackChainToHermes(updated);
    appendAuditLine({ action: "fallback.config.update", resource: "config", ok: true });
    return ok({ config: updated });
  } catch (error) {
    return serverErrorFromCatch(
      "PUT /api/models/fallbacks/config",
      "updating fallback config",
      error,
      "Failed to update fallback config",
    );
  }
}