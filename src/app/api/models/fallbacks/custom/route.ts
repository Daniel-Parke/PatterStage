// ═══════════════════════════════════════════════════════════════
// /api/models/fallbacks/custom — add custom (non-registry) fallback
// ═══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";
import { requireMcApiKey, requireNotReadOnly } from "@/lib/api-auth";
import { logApiError } from "@/lib/api-logger";
import { addFallbackEntry } from "@/lib/fallbacks-repository";

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

  const body = raw as Record<string, string>;
  const { name, provider, modelIdString, baseUrl } = body ?? {};
  if (!name || !provider || !modelIdString) {
    return NextResponse.json({
      error: "name, provider, modelIdString are required",
    }, { status: 400 });
  }

  try {
    const entry = addFallbackEntry({
      modelId: null,
      modelName: name,
      provider,
      modelIdString,
      overrideBaseUrl: baseUrl ?? null,
    });
    return NextResponse.json({ data: { entry } }, { status: 201 });
  } catch (error) {
    logApiError("POST /api/models/fallbacks/custom", "adding custom fallback", error);
    return NextResponse.json({ error: "Failed to add custom fallback" }, { status: 500 });
  }
}
