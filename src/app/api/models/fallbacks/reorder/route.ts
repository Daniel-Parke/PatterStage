// ═══════════════════════════════════════════════════════════════
// /api/models/fallbacks/reorder — swap two adjacent entries
// ═══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { parseJsonBody } from "@/lib/parse-json-body";
import { serverErrorFromCatch } from "@/lib/api-logger";
import { getFallbackEntry, updateFallbackEntry, listFallbackChain } from "@/lib/fallbacks-repository";
import { fallbackReorderSchema } from "@/lib/fallback-config-schema";
import { inTransaction } from "@/lib/db";
import { commitFallbackChange } from "@/lib/fallback-sync-helpers";
import { zodErrorResponse } from "@/lib/api-schemas";
import { notFound, ok } from "@/lib/api-response";

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

  const bodyResult = await parseJsonBody(request);
  if (bodyResult instanceof NextResponse) return bodyResult;

  const parsed = fallbackReorderSchema.safeParse(bodyResult);
  if (!parsed.success) {
    return zodErrorResponse(parsed.error);
  }

  const { entryId, direction } = parsed.data;

  try {
    const entry = getFallbackEntry(entryId);
    if (!entry) {
      return notFound("Entry not found");
    }

    const chain = listFallbackChain();
    const idx = chain.findIndex((e) => e.id === entryId);
    if (idx === -1) {
      return notFound("Entry not in chain");
    }

    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= chain.length) {
      // Already at top/bottom — no-op
      return ok({ fallbacks: chain });
    }

    // Swap positions atomically
    inTransaction(() => {
      const posA = chain[idx].position;
      const posB = chain[targetIdx].position;
      updateFallbackEntry(chain[idx].id, { position: posB });
      updateFallbackEntry(chain[targetIdx].id, { position: posA });
    });

    commitFallbackChange("fallback.reorder", entryId);

    const refreshed = listFallbackChain();
    return ok({ fallbacks: refreshed });
  } catch (error) {
    return serverErrorFromCatch(
      "POST /api/models/fallbacks/reorder",
      "reordering fallback",
      error,
      "Failed to reorder fallbacks",
    );
  }
}
