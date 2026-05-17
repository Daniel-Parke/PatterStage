// ═══════════════════════════════════════════════════════════════
// Hermes Kanban API — Reclaim a task (force-release claim)
// ═══════════════════════════════════════════════════════════════
// POST /api/orchestration/hermes-kanban/[id]/reclaim
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "../../../../../../lib/api-auth";
import { logApiError } from "../../../../../../lib/api-logger";
import * as bridge from "../../../../../../lib/hermes-kanban-bridge";

function handleError(error: unknown, context: string) {
  logApiError("hermes-kanban", context, error);
  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Request failed" },
    { status: 500 },
  );
}

/** POST /api/orchestration/hermes-kanban/[id]/reclaim — force-release a stuck claim. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireAuth(request);
  if (auth) return auth;

  try {
    const { id } = await params;
    await bridge.reclaimTask(id);
    return NextResponse.json({ data: { id, reclaimed: true } });
  } catch (error) {
    return handleError(error, `POST [id]/reclaim ${(await params).id}`);
  }
}
