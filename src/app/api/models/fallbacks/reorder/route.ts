// ═══════════════════════════════════════════════════════════════
// /api/models/fallbacks/reorder — swap two adjacent entries
// ═══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { logApiError } from "@/lib/api-logger";
import { appendAuditLine } from "@/lib/audit-log";
import { getFallbackEntry, updateFallbackEntry, listFallbackChain, getFallbackConfig } from "@/lib/fallbacks-repository";
import { fallbackReorderSchema } from "@/lib/fallback-config-schema";
import { inTransaction } from "@/lib/db";
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

  const parsed = fallbackReorderSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { entryId, direction } = parsed.data;

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

    // Swap positions atomically
    inTransaction(() => {
      const posA = chain[idx].position;
      const posB = chain[targetIdx].position;
      updateFallbackEntry(chain[idx].id, { position: posB });
      updateFallbackEntry(chain[targetIdx].id, { position: posA });
    });

    syncEnabledFallbackChainToHermes(getFallbackConfig());
    try {
      appendAuditLine({
        action: "fallback.reorder",
        resource: entryId,
        ok: true,
      });
    } catch {
      // Non-fatal
    }

    const refreshed = listFallbackChain();
    return NextResponse.json({ data: { fallbacks: refreshed } });
  } catch (error) {
    logApiError("POST /api/models/fallbacks/reorder", "reordering fallback", error);
    return NextResponse.json({ error: "Failed to reorder fallbacks" }, { status: 500 });
  }
}
