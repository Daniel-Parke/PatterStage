// ═══════════════════════════════════════════════════════════════
// /api/models/fallbacks/[id] — GET/PUT/DELETE single fallback entry
// ═══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { parseJsonBody } from "@/lib/parse-json-body";
import { logApiError } from "@/lib/api-logger";
import { getFallbackEntry, updateFallbackEntry, deleteFallbackEntry } from "@/lib/fallbacks-repository";
import { fallbackEntryPutSchema } from "@/lib/fallback-config-schema";
import { commitFallbackChange } from "@/lib/fallback-sync-helpers";
import { zodErrorResponse } from "@/lib/api-schemas";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request);
  if (auth) return auth;

  const { id } = await params;
  try {
    const entry = getFallbackEntry(id);
    if (!entry) {
      return NextResponse.json({ error: "Fallback entry not found" }, { status: 404 });
    }
    return NextResponse.json({ data: { fallback: entry } });
  } catch (error) {
    logApiError("GET /api/models/fallbacks/[id]", `reading ${id}`, error);
    return NextResponse.json({ error: "Failed to read fallback" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request);
  if (auth) return auth;

  const { id } = await params;

  const bodyResult = await parseJsonBody(request);
  if (bodyResult instanceof NextResponse) return bodyResult;

  const parsed = fallbackEntryPutSchema.safeParse(bodyResult);
  if (!parsed.success) {
    return zodErrorResponse(parsed.error);
  }

  try {
    const updated = updateFallbackEntry(id, parsed.data);
    if (!updated) {
      return NextResponse.json({ error: "Fallback entry not found" }, { status: 404 });
    }

    commitFallbackChange("fallback.update", id);
    return NextResponse.json({ data: { fallback: updated } });
  } catch (error) {
    logApiError("PUT /api/models/fallbacks/[id]", `updating ${id}`, error);
    return NextResponse.json({ error: "Failed to update fallback" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request);
  if (auth) return auth;

  const { id } = await params;

  try {
    const deleted = deleteFallbackEntry(id);
    if (!deleted) {
      return NextResponse.json({ error: "Fallback entry not found" }, { status: 404 });
    }

    commitFallbackChange("fallback.delete", id);
    return NextResponse.json({ data: { deleted: true } });
  } catch (error) {
    logApiError("DELETE /api/models/fallbacks/[id]", `deleting ${id}`, error);
    return NextResponse.json({ error: "Failed to delete fallback" }, { status: 500 });
  }
}
