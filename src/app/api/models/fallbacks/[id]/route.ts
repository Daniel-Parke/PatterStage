// ═══════════════════════════════════════════════════════════════
// /api/models/fallbacks/[id] — GET/PUT/DELETE single fallback entry
// ═══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";

import { parseAndValidateJsonBody } from "@/lib/parse-json-body";
import { getFallbackEntry, updateFallbackEntry, deleteFallbackEntry } from "@/lib/fallbacks-repository";
import { fallbackEntryPutSchema } from "@/lib/fallback-config-schema";
import { commitFallbackChange } from "@/modules/hermes/lib/fallback-sync";
import { notFound, ok } from "@/lib/api-response";
import { route } from "@/lib/api-route";

export const GET = route("GET /api/models/fallbacks/[id]", (p) => `reading ${p.id}`, "Failed to read fallback", async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const entry = getFallbackEntry(id);
  if (!entry) {
    return notFound("Fallback entry not found");
  }
  return ok({ fallback: entry });
});

export const PUT = route("PUT /api/models/fallbacks/[id]", (p) => `updating ${p.id}`, "Failed to update fallback", async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;

  const parsed = await parseAndValidateJsonBody(request, fallbackEntryPutSchema);
  if (parsed instanceof NextResponse) return parsed;
  const updated = updateFallbackEntry(id, parsed);
  if (!updated) {
    return notFound("Fallback entry not found");
  }

  commitFallbackChange("fallback.update", id);
  return ok({ fallback: updated });
});

export const DELETE = route("DELETE /api/models/fallbacks/[id]", (p) => `deleting ${p.id}`, "Failed to delete fallback", async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const deleted = deleteFallbackEntry(id);
  if (!deleted) {
    return notFound("Fallback entry not found");
  }

  commitFallbackChange("fallback.delete", id);
  return ok({ deleted: true });
});
