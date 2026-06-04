// ═══════════════════════════════════════════════════════════════
// /api/models/fallbacks/sync — write fallback chain + config to Hermes
// ═══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";
import { toError } from "@/lib/api-fetch";
import { requireAuth } from "@/lib/api-auth";
import { parseAndValidateJsonBody } from "@/lib/parse-json-body";
import { logApiError } from "@/lib/api-logger";
import { appendAuditLine } from "@/lib/audit-log";
import { fallbackSyncPostSchema } from "@/lib/fallback-config-schema";
import { getFallbackConfig, updateFallbackConfigBatch } from "@/lib/fallbacks-repository";
import { syncEnabledFallbackChainToHermes } from "@/lib/fallback-sync-helpers";
import { ok, serverError } from "@/lib/api-response";

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

  const parsed = await parseAndValidateJsonBody(request, fallbackSyncPostSchema);
  if (parsed instanceof NextResponse) return parsed;

  try {
    if (parsed.config && Object.keys(parsed.config).length > 0) {
      updateFallbackConfigBatch(parsed.config);
    }

    const config = getFallbackConfig();
    const result = syncEnabledFallbackChainToHermes(config);

    appendAuditLine({ action: "fallback.sync", resource: "hermes", ok: true });

    const hermesHome = result?.hermesHome ?? null;
    const configPath = result?.configPath ?? null;
    const backupPath = result?.backupPath ?? null;

    return ok({
      success: true,
      config,
      hermesHome,
      configPath,
      backupPath,
    });
  } catch (error) {
    logApiError("POST /api/models/fallbacks/sync", "syncing fallback to Hermes", error);
    return serverError(toError(error).message);
  }
}
