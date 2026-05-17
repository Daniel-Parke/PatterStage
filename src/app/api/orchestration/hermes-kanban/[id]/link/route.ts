// ═══════════════════════════════════════════════════════════════
// Hermes Kanban API — Link two tasks (parent→child dependency)
// ═══════════════════════════════════════════════════════════════
// POST /api/orchestration/hermes-kanban/[id]/link
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

/** POST /api/orchestration/hermes-kanban/[id]/link — link parent→child. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireAuth(request);
  if (auth) return auth;

  try {
    const { id } = await params;
    const body = await request.json();
    const { childId } = body as { childId: string };

    if (!childId) {
      return NextResponse.json(
        { error: "childId is required" },
        { status: 400 },
      );
    }
    await bridge.linkTasks(id, childId);
    return NextResponse.json({ data: { parentId: id, childId, linked: true } });
  } catch (error) {
    return handleError(error, `POST [id]/link ${(await params).id}`);
  }
}
