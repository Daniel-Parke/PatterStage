// ═══════════════════════════════════════════════════════════════
// /api/models/fallbacks — list + create fallback chain entries
// ═══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { parseAndValidateJsonBody } from "@/lib/parse-json-body";
import { serverErrorFromCatch } from "@/lib/api-logger";
import { addFallbackEntry, getFallbackConfig, listFallbackChain } from "@/lib/fallbacks-repository";
import { fallbackInputSchema } from "@/lib/fallback-config-schema";
import { commitFallbackChange } from "@/lib/fallback-sync-helpers";
import { created, ok } from "@/lib/api-response";

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

  try {
    return ok({ entries: listFallbackChain(), config: getFallbackConfig() });
  } catch (error) {
    return serverErrorFromCatch(
      "GET /api/models/fallbacks",
      "reading fallback chain",
      error,
      "Failed to read fallback chain",
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

  const parsed = await parseAndValidateJsonBody(request, fallbackInputSchema);
  if (parsed instanceof NextResponse) return parsed;

  try {
    const entry = addFallbackEntry(parsed);
    commitFallbackChange("fallback.add", entry.id);
    return created({ entry });
  } catch (error) {
    return serverErrorFromCatch(
      "POST /api/models/fallbacks",
      "adding fallback entry",
      error,
      "Failed to add fallback entry",
    );
  }
}
