// ═══════════════════════════════════════════════════════════════
// /api/models/fallbacks/sync — write fallback chain + config to Hermes
// ═══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";
import { requireMcApiKey, requireNotReadOnly } from "@/lib/api-auth";
import { logApiError } from "@/lib/api-logger";
import { listFallbackChain, getFallbackConfig } from "@/lib/fallbacks-repository";
import { syncFallbacksToHermesConfig } from "@/lib/hermes-config-sync";

export async function POST(request: NextRequest) {
  const ro = requireNotReadOnly();
  if (ro) return ro;
  const auth = requireMcApiKey(request);
  if (auth) return auth;

  try {
    const chain = listFallbackChain().filter((e) => e.enabled);
    const config = getFallbackConfig();

    const result = syncFallbacksToHermesConfig(
      chain.map((e) => ({
        modelId: e.modelIdString,
        provider: e.provider,
        baseUrl: e.overrideBaseUrl,
        apiKey: null,
      })),
      {
        restorePrimaryOnFallback: config.restorePrimaryOnFallback,
        fallbackNotification: config.fallbackNotification,
        apiMaxRetries: config.apiMaxRetries,
      }
    );

    return NextResponse.json({ data: { success: true, backupPath: result.backupPath } });
  } catch (error) {
    logApiError("POST /api/models/fallbacks/sync", "syncing fallback to Hermes", error);
    return NextResponse.json({ error: "Failed to sync fallback" }, { status: 500 });
  }
}
