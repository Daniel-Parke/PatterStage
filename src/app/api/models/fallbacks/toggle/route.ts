// ══════════════════════════════════════════════════════════════
// /api/models/fallbacks/toggle — toggle enabled for fallback entry
// ══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";
import { requireMcApiKey, requireNotReadOnly } from "@/lib/api-auth";
import { logApiError } from "@/lib/api-logger";
import { toggleFallbackEntry } from "@/lib/fallbacks-repository";

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
  const enabled = body?.enabled as boolean | undefined;

  if (!entryId || enabled === undefined) {
    return NextResponse.json({
      error: "entryId and enabled are required"
    }, { status: 400 });
  }

  try {
    const entry = toggleFallbackEntry(entryId, enabled);
    return NextResponse.json({ data: { entry } });
  } catch (error) {
    logApiError("POST /api/models/fallbacks/toggle", "toggling fallback", error);
    return NextResponse.json({ error: "Failed to toggle fallback" }, { status: 500 });
  }
}
