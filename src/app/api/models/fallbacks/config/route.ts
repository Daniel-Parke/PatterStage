// ═══════════════════════════════════════════════════════════════
// /api/models/fallbacks/config — GET/PUT fallback behaviour config
// ═══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireMcApiKey, requireNotReadOnly } from "@/lib/api-auth";
import { logApiError } from "@/lib/api-logger";
import { appendAuditLine } from "@/lib/audit-log";
import { getFallbackConfig, updateFallbackConfigBatch, listFallbackChain } from "@/lib/fallbacks-repository";
import { syncFallbacksToHermesConfig } from "@/lib/hermes-config-sync";

const configPutSchema = z.object({
  restorePrimaryOnFallback: z.boolean().optional(),
  fallbackNotification: z.boolean().optional(),
  apiMaxRetries: z.number().int().min(0).max(10).optional(),
});

export async function GET() {
  try {
    return NextResponse.json({ data: { config: getFallbackConfig() } });
  } catch (error) {
    logApiError("GET /api/models/fallbacks/config", "reading config", error);
    return NextResponse.json({ error: "Failed to read fallback config" }, { status: 500 });
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

  const parsed = configPutSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const updated = updateFallbackConfigBatch(parsed.data);

    // Re-sync fallback chain to Hermes config
    const chain = listFallbackChain().filter((e) => e.enabled);
    syncFallbacksToHermesConfig(
      chain.map((e) => ({
        modelId: e.modelIdString,
        provider: e.provider,
        baseUrl: e.overrideBaseUrl,
        apiKey: null,
      })),
      {
        restorePrimaryOnFallback: updated.restorePrimaryOnFallback,
        fallbackNotification: updated.fallbackNotification,
        apiMaxRetries: updated.apiMaxRetries,
      }
    );

    appendAuditLine({ action: "fallback.config.update", resource: "config", ok: true });
    return NextResponse.json({ data: { config: updated } });
  } catch (error) {
    logApiError("PUT /api/models/fallbacks/config", "updating config", error);
    return NextResponse.json({ error: "Failed to update fallback config" }, { status: 500 });
  }
}