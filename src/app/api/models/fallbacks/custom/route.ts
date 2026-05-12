// ══════════════════════════════════════════════════════════════
// /api/models/fallbacks/custom — add custom (non-registry) fallback
// ══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireMcApiKey, requireNotReadOnly } from "@/lib/api-auth";
import { logApiError } from "@/lib/api-logger";
import { appendAuditLine } from "@/lib/audit-log";
import { addFallbackEntry, listFallbackChain, getFallbackConfig } from "@/lib/fallbacks-repository";
import { syncFallbacksToHermesConfig } from "@/lib/hermes-config-sync";

const customFallbackSchema = z.object({
  modelName: z.string().min(1),
  provider: z.string().min(1),
  modelIdString: z.string().min(1),
  position: z.number().int().min(0).optional(),
  enabled: z.boolean().optional(),
  overrideBaseUrl: z.string().nullable().optional(),
});

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

  const parsed = customFallbackSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const input = {
      modelId: null,
      position: parsed.data.position,
      enabled: parsed.data.enabled,
      overrideBaseUrl: parsed.data.overrideBaseUrl,
      modelName: parsed.data.modelName,
      provider: parsed.data.provider,
      modelIdString: parsed.data.modelIdString,
    };
    const entry = addFallbackEntry(input);
    // Sync the chain so the new entry reaches Hermes config.yaml
    const chain = listFallbackChain().filter((e) => e.enabled);
    syncFallbacksToHermesConfig(
      chain.map((e) => ({
        modelId: e.modelIdString,
        provider: e.provider,
        baseUrl: e.overrideBaseUrl,
        apiKey: null,
      })),
      getFallbackConfig()
    );
    appendAuditLine({ action: "fallback.custom.add", resource: entry.id, ok: true });
    return NextResponse.json({ data: { entry } }, { status: 201 });
  } catch (error) {
    logApiError("POST /api/models/fallbacks/custom", "adding custom fallback", error);
    return NextResponse.json({ error: "Failed to add custom fallback" }, { status: 500 });
  }
}
