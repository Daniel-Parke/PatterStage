// ═══════════════════════════════════════════════════════════════
// /api/models/fallbacks — list + create fallback chain entries
// ═══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireMcApiKey, requireNotReadOnly } from "@/lib/api-auth";
import { logApiError } from "@/lib/api-logger";
import { appendAuditLine } from "@/lib/audit-log";
import { listFallbackChain, addFallbackEntry } from "@/lib/fallbacks-repository";
import { getModel } from "@/lib/models-repository";
import { syncFallbacksToHermesConfig } from "@/lib/hermes-config-sync";

const fallbackPostSchema = z.object({
  modelId: z.string().min(1),
  position: z.number().int().min(0).optional(),
  enabled: z.boolean().optional(),
  overrideBaseUrl: z.string().nullable().optional(),
});

export async function GET() {
  try {
    return NextResponse.json({ data: { fallbacks: listFallbackChain() } });
  } catch (error) {
    logApiError("GET /api/models/fallbacks", "listing fallbacks", error);
    return NextResponse.json({ error: "Failed to list fallbacks" }, { status: 500 });
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

  const parsed = fallbackPostSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    // Validate model exists
    const model = getModel(parsed.data.modelId);
    if (!model) {
      return NextResponse.json({ error: "Model not found" }, { status: 404 });
    }

    const entry = addFallbackEntry(parsed.data);
    syncFallbacksToHermesConfig([], {});
    appendAuditLine({ action: "fallback.create", resource: entry.id, ok: true });
    return NextResponse.json({ data: { fallback: entry } }, { status: 201 });
  } catch (error) {
    logApiError("POST /api/models/fallbacks", "creating fallback", error);
    return NextResponse.json({ error: "Failed to create fallback" }, { status: 500 });
  }
}