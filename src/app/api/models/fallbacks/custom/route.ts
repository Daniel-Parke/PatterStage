// ═══════════════════════════════════════════════════════════════
// /api/models/fallbacks/custom — add custom (non-registry) fallback
// ══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { logApiError } from "@/lib/api-logger";
import { appendAuditLine } from "@/lib/audit-log";
import { addFallbackEntry, getFallbackConfig } from "@/lib/fallbacks-repository";
import { customFallbackInputSchema } from "@/lib/fallback-config-schema";
import { syncEnabledFallbackChainToHermes } from "@/lib/fallback-sync-helpers";

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = customFallbackInputSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const entry = addFallbackEntry({
      modelId: null,
      modelName: parsed.data.modelName,
      provider: parsed.data.provider,
      modelIdString: parsed.data.modelIdString,
      position: parsed.data.position,
      enabled: parsed.data.enabled,
      overrideBaseUrl: parsed.data.overrideBaseUrl,
    });
    syncEnabledFallbackChainToHermes(getFallbackConfig());
    try {
      appendAuditLine({ action: "fallback.custom.add", resource: entry.id, ok: true });
    } catch {
      // Non-fatal
    }
    return NextResponse.json({ data: { entry } }, { status: 201 });
  } catch (error) {
    logApiError("POST /api/models/fallbacks/custom", "adding custom fallback", error);
    return NextResponse.json({ error: "Failed to add custom fallback" }, { status: 500 });
  }
}
