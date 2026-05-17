// ═══════════════════════════════════════════════════════════════
// Hermes Kanban API — Reassign a task to a different profile
// ═══════════════════════════════════════════════════════════════
// POST /api/orchestration/hermes-kanban/[id]/reassign
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

/** POST /api/orchestration/hermes-kanban/[id]/reassign — reassign task to a new profile. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireAuth(request);
  if (auth) return auth;

  try {
    const { id } = await params;
    const body = await request.json();
    const { assignee, reclaim } = body as { assignee: string; reclaim?: boolean };

    if (!assignee) {
      return NextResponse.json(
        { error: "assignee is required" },
        { status: 400 },
      );
    }
    await bridge.reassignTask(id, assignee, reclaim);
    return NextResponse.json({ data: { id, assignee, reassigned: true } });
  } catch (error) {
    return handleError(error, `POST [id]/reassign ${(await params).id}`);
  }
}
