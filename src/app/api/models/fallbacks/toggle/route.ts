// ═══════════════════════════════════════════════════════════════
// /api/models/fallbacks/toggle — toggle enabled for fallback entry
// ══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { parseAndValidateJsonBody } from "@/lib/parse-json-body";
import { serverErrorFromCatch } from "@/lib/api-logger";
import { toggleFallbackEntry } from "@/lib/fallbacks-repository";
import { fallbackToggleSchema } from "@/lib/fallback-config-schema";
import { commitFallbackChange } from "@/lib/fallback-sync-helpers";
import { notFound, ok } from "@/lib/api-response";

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

  const parsed = await parseAndValidateJsonBody(request, fallbackToggleSchema);
  if (parsed instanceof NextResponse) return parsed;

  try {
    const entry = toggleFallbackEntry(parsed.id, parsed.enabled);
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
