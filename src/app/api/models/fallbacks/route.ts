// ═══════════════════════════════════════════════════════════════
// /api/models/fallbacks — list + create fallback chain entries
// ═══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireMcApiKey, requireNotReadOnly } from "@/lib/api-auth";
import { logApiError } from "@/lib/api-logger";
import { appendAuditLine } from "@/lib/audit-log";
import { listFallbackChain, addFallbackEntry } from "@/lib/fallbacks-repository";
import { getFallbackConfig } from "@/lib/fallbacks-repository";
import { syncFallbacksToHermesConfig } from "@/lib/hermes-config-sync";

const fallbackInputSchema = z.object({
  modelId: z.string().min(1),
  position: z.number().int().min(0).optional(),
  enabled: z.boolean().optional(),
  overrideBaseUrl: z.string().nullable().optional(),
});

export async function GET(_request: NextRequest) {
  try {
    const entries = listFallbackChain();
    const config = getFallbackConfig();
    return NextResponse.json({ data: { entries, config } });
  } catch (error) {
    logApiError("GET /api/models/fallbacks", "reading fallback chain", error);
    return NextResponse.json({ error: "Failed to read fallback chain" }, { status: 500 });
  }
}

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

  const parsed = fallbackInputSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const entry = addFallbackEntry(parsed.data);
    // Sync the actual chain (not empty) so the new entry reaches Hermes config.yaml
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
    appendAuditLine({ action: "fallback.add", resource: entry.id, ok: true });
    return NextResponse.json({ data: { entry } }, { status: 201 });
  } catch (error) {
    logApiError("POST /api/models/fallbacks", "adding fallback entry", error);
    return NextResponse.json({ error: "Failed to add fallback entry" }, { status: 500 });
  }
}
