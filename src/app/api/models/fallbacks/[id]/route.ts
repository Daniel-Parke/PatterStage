// ═══════════════════════════════════════════════════════════════
// /api/models/fallbacks/[id] — GET/PUT/DELETE single fallback entry
// ═══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { parseJsonBody } from "@/lib/parse-json-body";
import { serverErrorFromCatch } from "@/lib/api-logger";
import { getFallbackEntry, updateFallbackEntry, deleteFallbackEntry } from "@/lib/fallbacks-repository";
import { fallbackEntryPutSchema } from "@/lib/fallback-config-schema";
import { commitFallbackChange } from "@/lib/fallback-sync-helpers";
import { zodErrorResponse } from "@/lib/api-schemas";
import { notFound } from "@/lib/api-response";

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
      return notFound("Fallback entry not found");
    }
    return NextResponse.json({ data: { fallback: entry } });
  } catch (error) {
    return serverErrorFromCatch(
      "GET /api/models/fallbacks/[id]",
      `reading ${id}`,
      error,
      "Failed to read fallback",
    );
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
      return notFound("Fallback entry not found");
    }

    commitFallbackChange("fallback.update", id);
    return NextResponse.json({ data: { fallback: updated } });
  } catch (error) {
    return serverErrorFromCatch(
      "PUT /api/models/fallbacks/[id]",
      `updating ${id}`,
      error,
      "Failed to update fallback",
    );
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
      return notFound("Fallback entry not found");
    }

    commitFallbackChange("fallback.delete", id);
    return NextResponse.json({ data: { deleted: true } });
  } catch (error) {
    return serverErrorFromCatch(
      "DELETE /api/models/fallbacks/[id]",
      `deleting ${id}`,
      error,
      "Failed to delete fallback",
    );
  }
}
