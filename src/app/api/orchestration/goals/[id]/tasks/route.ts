// ═══════════════════════════════════════════════════════════════
// Goals API — Kanban task linking
// ═══════════════════════════════════════════════════════════════
// POST   /api/orchestration/goals/[id]/tasks  — link a kanban task
// DELETE /api/orchestration/goals/[id]/tasks  — unlink a kanban task
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { logApiError } from "@/lib/api-logger";
import * as goals from "@/lib/goals-bridge";

function handleError(error: unknown, context: string) {
  logApiError("goals", context, error);
  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Request failed" },
    { status: 500 },
  );
}

/** POST /api/orchestration/goals/[id]/tasks — link a kanban task to this goal. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireAuth(request);
  if (auth) return auth;

  try {
    const { id } = await params;
    const body = await request.json();

    if (!body.task_id || typeof body.task_id !== "string" || !body.task_id.trim()) {
      return NextResponse.json({ error: "task_id is required" }, { status: 400 });
    }

    const ok = goals.linkKanbanTask(id, body.task_id.trim());
    if (!ok) {
      return NextResponse.json({ error: "Goal not found or link failed" }, { status: 404 });
    }

    return NextResponse.json({ data: { goal_id: id, task_id: body.task_id, linked: true } });
  } catch (error) {
    return handleError(error, `POST tasks ${(await params).id}`);
  }
}

/** DELETE /api/orchestration/goals/[id]/tasks — unlink a kanban task from this goal. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireAuth(request);
  if (auth) return auth;

  try {
    const { id } = await params;
    const body = await request.json();

    if (!body.task_id || typeof body.task_id !== "string" || !body.task_id.trim()) {
      return NextResponse.json({ error: "task_id is required" }, { status: 400 });
    }

    const ok = goals.unlinkKanbanTask(id, body.task_id.trim());
    if (!ok) {
      return NextResponse.json({ error: "Task link not found" }, { status: 404 });
    }

    return NextResponse.json({ data: { goal_id: id, task_id: body.task_id, unlinked: true } });
  } catch (error) {
    return handleError(error, `DELETE tasks ${(await params).id}`);
  }
}
