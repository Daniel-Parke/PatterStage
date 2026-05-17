// ═══════════════════════════════════════════════════════════════
// Hermes Kanban API — Block or unblock a task
// ═══════════════════════════════════════════════════════════════
// POST /api/orchestration/hermes-kanban/[id]/block
//   body: { action: "block", reason: "..." }  — block task
//   body: { action: "unblock" }               — unblock task
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

/** POST /api/orchestration/hermes-kanban/[id]/block — block or unblock a task. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireAuth(request);
  if (auth) return auth;

  try {
    const { id } = await params;
    const body = await request.json();
    const { action, reason } = body as { action?: string; reason?: string };

    if (action === "unblock") {
      await bridge.unblockTask(id);
      return NextResponse.json({ data: { id, status: "unblocked" } });
    }

    // Default: block with a reason
    if (!reason) {
      return NextResponse.json(
        { error: "reason is required to block a task" },
        { status: 400 },
      );
    }
    await bridge.blockTask(id, reason);
    return NextResponse.json({ data: { id, status: "blocked" } });
  } catch (error) {
    return handleError(error, `POST [id]/block ${(await params).id}`);
  }
}
