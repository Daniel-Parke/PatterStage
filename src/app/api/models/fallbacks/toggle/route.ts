// ══════════════════════════════════════════════════════════════
// /api/models/fallbacks/toggle — toggle enabled for fallback entry
// ══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireMcApiKey, requireNotReadOnly } from "@/lib/api-auth";
import { logApiError } from "@/lib/api-logger";
import { appendAuditLine } from "@/lib/audit-log";
import { toggleFallbackEntry, listFallbackChain, getFallbackConfig } from "@/lib/fallbacks-repository";
import { syncFallbacksToHermesConfig } from "@/lib/hermes-config-sync";

export async function POST(request: NextRequest) {
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

  const parsed = z.object({ id: z.string(), enabled: z.boolean() }).safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const entry = toggleFallbackEntry(parsed.data.id, parsed.data.enabled);
    if (!entry) {
      return NextResponse.json({ error: "Fallback entry not found" }, { status: 404 });
    }
    // Sync the chain so the toggled state reaches Hermes config.yaml
    const chain = listFallbackChain().filter((e) => e.enabled);
    syncFallbacksToHermesConfig(
      chain.map((e) => ({
        modelId: e.modelIdString,
        provider: e.provider,
        baseUrl: null,
        overrideBaseUrl: e.overrideBaseUrl,
        apiKey: null,
      })),
      getFallbackConfig()
    );
    appendAuditLine({ action: `fallback.toggle`, resource: entry.id, ok: true });
    return NextResponse.json({ data: { entry } });
  } catch (error) {
    logApiError("POST /api/models/fallbacks/toggle", "toggling fallback", error);
    return NextResponse.json({ error: "Failed to toggle fallback" }, { status: 500 });
  }
}
