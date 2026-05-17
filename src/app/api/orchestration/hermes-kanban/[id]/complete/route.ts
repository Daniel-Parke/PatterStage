// ═══════════════════════════════════════════════════════════════
// Hermes Kanban API — Complete a task
// ═══════════════════════════════════════════════════════════════
// POST /api/orchestration/hermes-kanban/[id]/complete
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

/** POST /api/orchestration/hermes-kanban/[id]/complete — mark task done. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireAuth(request);
  if (auth) return auth;

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { summary, metadata, createdCards } = body;

    await bridge.completeTask(id, summary, metadata, createdCards);
    return NextResponse.json({ data: { id, status: "done" } });
  } catch (error) {
    return handleError(error, `POST [id]/complete ${(await params).id}`);
  }
}
