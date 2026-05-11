// ═══════════════════════════════════════════════════════════════
// /api/models/fallbacks/reorder — bulk reorder fallback chain
// ═══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireMcApiKey, requireNotReadOnly } from "@/lib/api-auth";
import { logApiError } from "@/lib/api-logger";
import { appendAuditLine } from "@/lib/audit-log";
import { reorderFallbackChain } from "@/lib/fallbacks-repository";
import { syncFallbacksToHermesConfig } from "@/lib/hermes-config-sync";

const reorderSchema = z.object({
  positions: z
    .array(
      z.object({
        id: z.string().min(1),
        position: z.number().int().min(0),
      })
    )
    .min(1),
});

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

  const parsed = reorderSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const reordered = reorderFallbackChain(parsed.data.positions);

    // Re-sync fallback chain to Hermes config
    const chain = reordered.filter((e) => e.enabled);
    syncFallbacksToHermesConfig(
      chain.map((e) => ({
        modelId: e.modelIdString,
        provider: e.provider,
        baseUrl: e.overrideBaseUrl,
        apiKey: null,
      })),
      {}
    );

    appendAuditLine({
      action: "fallback.reorder",
      resource: "bulk",
      ok: true,
    });
    return NextResponse.json({ data: { fallbacks: reordered } });
  } catch (error) {
    logApiError("PUT /api/models/fallbacks/reorder", "reordering fallbacks", error);
    return NextResponse.json({ error: "Failed to reorder fallbacks" }, { status: 500 });
  }
}