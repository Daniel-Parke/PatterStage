// ═══════════════════════════════════════════════════════════════
// /api/models/fallbacks/sync — write fallback chain + config to Hermes
// ═══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";
import { toError } from "@/lib/api-fetch";
import { requireAuth } from "@/lib/api-auth";
import { parseJsonBody } from "@/lib/parse-json-body";
import { logApiError } from "@/lib/api-logger";
import { appendAuditLine } from "@/lib/audit-log";
import { fallbackSyncPostSchema } from "@/lib/fallback-config-schema";
import { getFallbackConfig, updateFallbackConfigBatch } from "@/lib/fallbacks-repository";
import { syncEnabledFallbackChainToHermes } from "@/lib/fallback-sync-helpers";
import { zodErrorResponse } from "@/lib/api-schemas";
import { serverError } from "@/lib/api-response";

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

  const bodyResult = await parseJsonBody(request);
  if (bodyResult instanceof NextResponse) return bodyResult;

  const parsed = fallbackSyncPostSchema.safeParse(bodyResult);
  if (!parsed.success) {
    return zodErrorResponse(parsed.error);
  }

  try {
    if (parsed.data.config && Object.keys(parsed.data.config).length > 0) {
      updateFallbackConfigBatch(parsed.data.config);
    }

    const config = getFallbackConfig();
    const result = syncEnabledFallbackChainToHermes(config);

    appendAuditLine({ action: "fallback.sync", resource: "hermes", ok: true });

    const hermesHome = result?.hermesHome ?? null;
    const configPath = result?.configPath ?? null;
    const backupPath = result?.backupPath ?? null;

    return NextResponse.json({
      data: {
        success: true,
        config,
        hermesHome,
        configPath,
        backupPath,
      },
    });
  } catch (error) {
    logApiError("POST /api/models/fallbacks/sync", "syncing fallback to Hermes", error);
    return serverError(toError(error).message);
  }
}
