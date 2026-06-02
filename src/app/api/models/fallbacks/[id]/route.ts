// ═══════════════════════════════════════════════════════════════
// /api/models/fallbacks/[id] — GET/PUT/DELETE single fallback entry
// ═══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { logApiError } from "@/lib/api-logger";
import { appendAuditLine } from "@/lib/audit-log";
import { getFallbackEntry, updateFallbackEntry, deleteFallbackEntry, getFallbackConfig } from "@/lib/fallbacks-repository";
import { fallbackEntryPutSchema } from "@/lib/fallback-config-schema";
import { syncEnabledFallbackChainToHermes } from "@/lib/fallback-sync-helpers";
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

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = fallbackEntryPutSchema.safeParse(raw);
  if (!parsed.success) {
    return zodErrorResponse(parsed.error);
  }

  try {
    const updated = updateFallbackEntry(id, parsed.data);
    if (!updated) {
      return NextResponse.json({ error: "Fallback entry not found" }, { status: 404 });
    }

    syncEnabledFallbackChainToHermes(getFallbackConfig());
    appendAuditLine({ action: "fallback.update", resource: id, ok: true });
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

    syncEnabledFallbackChainToHermes(getFallbackConfig());
    appendAuditLine({ action: "fallback.delete", resource: id, ok: true });
    return NextResponse.json({ data: { deleted: true } });
  } catch (error) {
    logApiError("DELETE /api/models/fallbacks/[id]", `deleting ${id}`, error);
    return NextResponse.json({ error: "Failed to delete fallback" }, { status: 500 });
  }
}
