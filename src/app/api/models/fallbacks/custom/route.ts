// ═══════════════════════════════════════════════════════════════
// /api/models/fallbacks/custom — add custom (non-registry) fallback
// ══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { parseJsonBody } from "@/lib/parse-json-body";
import { logApiError } from "@/lib/api-logger";
import { addFallbackEntry } from "@/lib/fallbacks-repository";
import { customFallbackInputSchema } from "@/lib/fallback-config-schema";
import { commitFallbackChange } from "@/lib/fallback-sync-helpers";
import { zodErrorResponse } from "@/lib/api-schemas";
import { created, serverError } from "@/lib/api-response";

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

  const bodyResult = await parseJsonBody(request);
  if (bodyResult instanceof NextResponse) return bodyResult;

  const parsed = customFallbackInputSchema.safeParse(bodyResult);
  if (!parsed.success) {
    return zodErrorResponse(parsed.error);
  }

  try {
    const entry = addFallbackEntry({
      modelId: null,
      modelName: parsed.data.modelName,
      provider: parsed.data.provider,
      modelIdString: parsed.data.modelIdString,
      position: parsed.data.position,
      enabled: parsed.data.enabled,
      overrideBaseUrl: parsed.data.overrideBaseUrl,
    });
    commitFallbackChange("fallback.custom.add", entry.id);
    return created({ entry });
  } catch (error) {
    logApiError("POST /api/models/fallbacks/custom", "adding custom fallback", error);
    return serverError("Failed to add custom fallback");
  }
}
