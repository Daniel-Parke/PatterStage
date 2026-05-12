// ═══════════════════════════════════════════════════════════════
// /api/models/fallbacks/reorder — swap two adjacent entries
// ═══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";
import { requireMcApiKey, requireNotReadOnly } from "@/lib/api-auth";
import { logApiError } from "@/lib/api-logger";
import { appendAuditLine } from "@/lib/audit-log";
import {
  getFallbackEntry,
  updateFallbackEntry,
  listFallbackChain,
} from "@/lib/fallbacks-repository";
import { getFallbackConfig } from "@/lib/fallbacks-repository";
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

  const body = raw as Record<string, unknown>;
  const entryId = body?.entryId as string | undefined;
  const direction = body?.direction as "up" | "down" | undefined;

  if (!entryId || !direction) {
    return NextResponse.json({
      error: "entryId and direction are required",
    }, { status: 400 });
  }

  if (direction !== "up" && direction !== "down") {
    return NextResponse.json({ error: "direction must be 'up' or 'down'" }, { status: 400 });
  }

  try {
    const entry = getFallbackEntry(entryId);
    if (!entry) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    const chain = listFallbackChain();
    const idx = chain.findIndex((e) => e.id === entryId);
    if (idx === -1) {
      return NextResponse.json({ error: "Entry not in chain" }, { status: 404 });
    }

    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= chain.length) {
      // Already at top/bottom — no-op
      return NextResponse.json({ data: { fallbacks: chain } });
    }

    // Swap positions
    const posA = chain[idx].position;
    const posB = chain[targetIdx].position;

    updateFallbackEntry(chain[idx].id, { position: posB });
    updateFallbackEntry(chain[targetIdx].id, { position: posA });

    // Re-sync
    const updatedChain = listFallbackChain().filter((e) => e.enabled);
    syncFallbacksToHermesConfig(
      updatedChain.map((e) => ({
        modelId: e.modelIdString,
        provider: e.provider,
        baseUrl: e.overrideBaseUrl,
        apiKey: null,
      })),
      getFallbackConfig()
    );

    appendAuditLine({
      action: "fallback.reorder",
      resource: entryId,
      ok: true,
    });

    const refreshed = listFallbackChain();
    return NextResponse.json({ data: { fallbacks: refreshed } });
  } catch (error) {
    logApiError("POST /api/models/fallbacks/reorder", "reordering fallback", error);
    return NextResponse.json({ error: "Failed to reorder fallbacks" }, { status: 500 });
  }
}
