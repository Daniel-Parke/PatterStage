// ═══════════════════════════════════════════════════════════════
// /api/models/fallbacks/[id] — GET/PUT/DELETE single fallback entry
// ═══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";

import { parseAndValidateJsonBody } from "@/lib/parse-json-body";
import { serverErrorFromCatch } from "@/lib/api-logger";
import { getFallbackEntry, updateFallbackEntry, deleteFallbackEntry } from "@/lib/fallbacks-repository";
import { fallbackEntryPutSchema } from "@/lib/fallback-config-schema";
import { commitFallbackChange } from "@/modules/hermes/lib/fallback-sync";
import { notFound, ok } from "@/lib/api-response";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const entry = getFallbackEntry(id);
    if (!entry) {
      return notFound("Fallback entry not found");
    }
    return ok({ fallback: entry });
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
  const { id } = await params;

  const parsed = await parseAndValidateJsonBody(request, fallbackEntryPutSchema);
  if (parsed instanceof NextResponse) return parsed;

  try {
    const updated = updateFallbackEntry(id, parsed);
    if (!updated) {
      return notFound("Fallback entry not found");
    }

    commitFallbackChange("fallback.update", id);
    return ok({ fallback: updated });
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
  const { id } = await params;

  try {
    const deleted = deleteFallbackEntry(id);
    if (!deleted) {
      return notFound("Fallback entry not found");
    }

    commitFallbackChange("fallback.delete", id);
    return ok({ deleted: true });
  } catch (error) {
    return serverErrorFromCatch(
      "DELETE /api/models/fallbacks/[id]",
      `deleting ${id}`,
      error,
      "Failed to delete fallback",
    );
  }
}
