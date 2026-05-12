// ═══════════════════════════════════════════════════════════════
// /api/models/fallbacks/[id] — GET/PUT/DELETE single fallback entry
// ═══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireMcApiKey, requireNotReadOnly } from "@/lib/api-auth";
import { logApiError } from "@/lib/api-logger";
import { appendAuditLine } from "@/lib/audit-log";
import {
  getFallbackEntry,
  updateFallbackEntry,
  deleteFallbackEntry,
  listFallbackChain, getFallbackConfig} from "@/lib/fallbacks-repository";
import { getModel } from "@/lib/models-repository";
import { syncFallbacksToHermesConfig } from "@/lib/hermes-config-sync";

const fallbackPutSchema = z.object({
  modelId: z.string().min(1).optional(),
  position: z.number().int().min(0).optional(),
  enabled: z.boolean().optional(),
  overrideBaseUrl: z.string().nullable().optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const entry = getFallbackEntry(id);
    if (!entry) {
      return NextResponse.json({ error: "Fallback entry not found" }, { status: 404 });
    }
    return NextResponse.json({ data: { fallback: entry } });
  } catch (error) {
    logApiError("GET /api/models/fallbacks/[id]", `reading ${id}`, error);
    return NextResponse.json({ error: "Failed to read fallback" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ro = requireNotReadOnly();
  if (ro) return ro;
  const auth = requireMcApiKey(request);
  if (auth) return auth;

  const { id } = await params;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = fallbackPutSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    // Validate model exists if modelId is being changed
    if (parsed.data.modelId) {
      const model = getModel(parsed.data.modelId);
      if (!model) {
        return NextResponse.json({ error: "Model not found" }, { status: 404 });
      }
    }

    const updated = updateFallbackEntry(id, parsed.data);
    if (!updated) {
      return NextResponse.json({ error: "Fallback entry not found" }, { status: 404 });
    }

    // Re-sync fallback chain to Hermes config
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

    appendAuditLine({ action: "fallback.update", resource: id, ok: true });
    return NextResponse.json({ data: { fallback: updated } });
  } catch (error) {
    logApiError("PUT /api/models/fallbacks/[id]", `updating ${id}`, error);
    return NextResponse.json({ error: "Failed to update fallback" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ro = requireNotReadOnly();
  if (ro) return ro;
  const auth = requireMcApiKey(request);
  if (auth) return auth;

  const { id } = await params;

  try {
    const deleted = deleteFallbackEntry(id);
    if (!deleted) {
      return NextResponse.json({ error: "Fallback entry not found" }, { status: 404 });
    }

    // Re-sync fallback chain to Hermes config
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

    appendAuditLine({ action: "fallback.delete", resource: id, ok: true });
    return NextResponse.json({ data: { deleted: true } });
  } catch (error) {
    logApiError("DELETE /api/models/fallbacks/[id]", `deleting ${id}`, error);
    return NextResponse.json({ error: "Failed to delete fallback" }, { status: 500 });
  }
}