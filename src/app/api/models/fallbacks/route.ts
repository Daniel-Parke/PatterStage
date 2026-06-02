// ═══════════════════════════════════════════════════════════════
// /api/models/fallbacks — list + create fallback chain entries
// ═══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { parseJsonBody } from "@/lib/parse-json-body";
import { logApiError } from "@/lib/api-logger";
import { addFallbackEntry, getFallbackConfig, listFallbackChain } from "@/lib/fallbacks-repository";
import { fallbackInputSchema } from "@/lib/fallback-config-schema";
import { commitFallbackChange } from "@/lib/fallback-sync-helpers";
import { zodErrorResponse } from "@/lib/api-schemas";
import { serverError } from "@/lib/api-response";

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

  try {
    return NextResponse.json({ data: { entries: listFallbackChain(), config: getFallbackConfig() } });
  } catch (error) {
    logApiError("GET /api/models/fallbacks", "reading fallback chain", error);
    return serverError("Failed to read fallback chain");
  }
}

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

  const bodyResult = await parseJsonBody(request);
  if (bodyResult instanceof NextResponse) return bodyResult;

  const parsed = fallbackInputSchema.safeParse(bodyResult);
  if (!parsed.success) {
    return zodErrorResponse(parsed.error);
  }

  try {
    const entry = addFallbackEntry(parsed.data);
    commitFallbackChange("fallback.add", entry.id);
    return NextResponse.json({ data: { entry } }, { status: 201 });
  } catch (error) {
    logApiError("POST /api/models/fallbacks", "adding fallback entry", error);
    return serverError("Failed to add fallback entry");
  }
}
