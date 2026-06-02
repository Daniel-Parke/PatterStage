// ═══════════════════════════════════════════════════════════════
// /api/models/fallbacks — list + create fallback chain entries
// ═══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { logApiError } from "@/lib/api-logger";
import { appendAuditLine } from "@/lib/audit-log";
import { addFallbackEntry, getFallbackConfig, listFallbackChain } from "@/lib/fallbacks-repository";
import { fallbackInputSchema } from "@/lib/fallback-config-schema";
import { syncEnabledFallbackChainToHermes } from "@/lib/fallback-sync-helpers";
import { zodErrorResponse } from "@/lib/api-schemas";

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

  try {
    const entries = listFallbackChain();
    return NextResponse.json({ data: { entries, config: getFallbackConfig() } });
  } catch (error) {
    logApiError("GET /api/models/fallbacks", "reading fallback chain", error);
    return NextResponse.json({ error: "Failed to read fallback chain" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = fallbackInputSchema.safeParse(raw);
  if (!parsed.success) {
    return zodErrorResponse(parsed.error);
  }

  try {
    const entry = addFallbackEntry(parsed.data);
    syncEnabledFallbackChainToHermes(getFallbackConfig());
    appendAuditLine({ action: "fallback.add", resource: entry.id, ok: true });
    return NextResponse.json({ data: { entry } }, { status: 201 });
  } catch (error) {
    logApiError("POST /api/models/fallbacks", "adding fallback entry", error);
    return NextResponse.json({ error: "Failed to add fallback entry" }, { status: 500 });
  }
}
