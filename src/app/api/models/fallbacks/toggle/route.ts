// ═══════════════════════════════════════════════════════════════
// /api/models/fallbacks/toggle — toggle enabled for fallback entry
// ══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { parseJsonBody } from "@/lib/parse-json-body";
import { serverErrorFromCatch } from "@/lib/api-logger";
import { toggleFallbackEntry } from "@/lib/fallbacks-repository";
import { fallbackToggleSchema } from "@/lib/fallback-config-schema";
import { commitFallbackChange } from "@/lib/fallback-sync-helpers";
import { zodErrorResponse } from "@/lib/api-schemas";
import { notFound, ok } from "@/lib/api-response";

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

  const bodyResult = await parseJsonBody(request);
  if (bodyResult instanceof NextResponse) return bodyResult;

  const parsed = fallbackToggleSchema.safeParse(bodyResult);
  if (!parsed.success) {
    return zodErrorResponse(parsed.error);
  }

  try {
    const entry = toggleFallbackEntry(parsed.data.id, parsed.data.enabled);
    if (!entry) {
      return notFound("Fallback entry not found");
    }
    commitFallbackChange("fallback.toggle", entry.id);
    return ok({ entry });
  } catch (error) {
    return serverErrorFromCatch(
      "POST /api/models/fallbacks/toggle",
      "toggling fallback",
      error,
      "Failed to toggle fallback",
    );
  }
}
