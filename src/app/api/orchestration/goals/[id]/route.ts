// ═══════════════════════════════════════════════════════════════
// Goals API — Single goal detail, update, and delete
// ═══════════════════════════════════════════════════════════════
// GET    /api/orchestration/goals/[id]  — get goal detail
// PATCH  /api/orchestration/goals/[id]  — update goal fields
// DELETE /api/orchestration/goals/[id]  — delete a goal
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

/** GET /api/orchestration/goals/[id] — get full goal detail with checkpoints and linked tasks. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const goal = goals.getGoal(id);
    if (!goal) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }
    return NextResponse.json({ data: goal });
  } catch (error) {
    return handleError(error, `GET [id] ${(await params).id}`);
  }
}

/** PATCH /api/orchestration/goals/[id] — update goal fields (title, description, status, priority, category, etc.). */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireAuth(request);
  if (auth) return auth;

  try {
    const { id } = await params;
    const body = await request.json();

    const goal = goals.updateGoal(id, {
      title: body.title,
      description: body.description,
      status: body.status,
      priority: body.priority,
      category: body.category,
      mission_id: body.mission_id,
      parent_goal_id: body.parent_goal_id,
    });

    if (!goal) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }

    return NextResponse.json({ data: goal });
  } catch (error) {
    return handleError(error, `PATCH [id] ${(await params).id}`);
  }
}

/** DELETE /api/orchestration/goals/[id] — delete a goal and its associated checkpoints/task links. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireAuth(request);
  if (auth) return auth;

  try {
    const { id } = await params;
    const ok = goals.deleteGoal(id);
    if (!ok) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }
    return NextResponse.json({ data: { deleted: id } });
  } catch (error) {
    return handleError(error, `DELETE [id] ${(await params).id}`);
  }
}
