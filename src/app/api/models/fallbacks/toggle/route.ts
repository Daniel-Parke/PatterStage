// ═══════════════════════════════════════════════════════════════
// /api/models/fallbacks/toggle — toggle enabled for fallback entry
// ══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { logApiError } from "@/lib/api-logger";
import { appendAuditLine } from "@/lib/audit-log";
import { toggleFallbackEntry, getFallbackConfig } from "@/lib/fallbacks-repository";
import { fallbackToggleSchema } from "@/lib/fallback-config-schema";
import { syncEnabledFallbackChainToHermes } from "@/lib/fallback-sync-helpers";
import { zodErrorResponse } from "@/lib/api-schemas";

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = fallbackToggleSchema.safeParse(raw);
  if (!parsed.success) {
    return zodErrorResponse(parsed.error);
  }

  try {
    const entry = toggleFallbackEntry(parsed.data.id, parsed.data.enabled);
    if (!entry) {
      return NextResponse.json({ error: "Fallback entry not found" }, { status: 404 });
    }
    syncEnabledFallbackChainToHermes(getFallbackConfig());
    try {
      appendAuditLine({ action: "fallback.toggle", resource: entry.id, ok: true });
    } catch {
      // Non-fatal
    }
    return NextResponse.json({ data: { entry } });
  } catch (error) {
    logApiError("POST /api/models/fallbacks/toggle", "toggling fallback", error);
    return NextResponse.json({ error: "Failed to toggle fallback" }, { status: 500 });
  }
}
