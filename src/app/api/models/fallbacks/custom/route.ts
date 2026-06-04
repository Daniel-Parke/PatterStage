// ═══════════════════════════════════════════════════════════════
// /api/models/fallbacks/custom — add custom (non-registry) fallback
// ══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { parseAndValidateJsonBody } from "@/lib/parse-json-body";
import { serverErrorFromCatch } from "@/lib/api-logger";
import { addFallbackEntry } from "@/lib/fallbacks-repository";
import { customFallbackInputSchema } from "@/lib/fallback-config-schema";
import { commitFallbackChange } from "@/lib/fallback-sync-helpers";
import { created } from "@/lib/api-response";

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

  const parsed = await parseAndValidateJsonBody(request, customFallbackInputSchema);
  if (parsed instanceof NextResponse) return parsed;

  try {
    const entry = addFallbackEntry({
      modelId: null,
      modelName: parsed.modelName,
      provider: parsed.provider,
      modelIdString: parsed.modelIdString,
      position: parsed.position,
      enabled: parsed.enabled,
      overrideBaseUrl: parsed.overrideBaseUrl,
    });
    commitFallbackChange("fallback.custom.add", entry.id);
    return created({ entry });
  } catch (error) {
    return serverErrorFromCatch(
      "POST /api/models/fallbacks/custom",
      "adding custom fallback",
      error,
      "Failed to add custom fallback",
    );
  }
}
