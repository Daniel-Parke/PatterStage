// ═══════════════════════════════════════════════════════════════
// Goals API — Checkpoint management
// ═══════════════════════════════════════════════════════════════
// GET    /api/orchestration/goals/[id]/checkpoints  — list checkpoints
// POST   /api/orchestration/goals/[id]/checkpoints  — add checkpoint
// PATCH  /api/orchestration/goals/[id]/checkpoints  — toggle checkpoint completion
// DELETE /api/orchestration/goals/[id]/checkpoints  — remove checkpoint
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

/** GET /api/orchestration/goals/[id]/checkpoints — list all checkpoints for a goal. */
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
    return NextResponse.json({ data: { checkpoints: goal.checkpoints } });
  } catch (error) {
    return handleError(error, `GET checkpoints ${(await params).id}`);
  }
}

/** POST /api/orchestration/goals/[id]/checkpoints — add a new checkpoint to a goal. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireAuth(request);
  if (auth) return auth;

  try {
    const { id } = await params;
    const body = await request.json();

    if (!body.title || typeof body.title !== "string" || !body.title.trim()) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    const checkpoint = goals.addCheckpoint(id, body.title.trim());
    if (!checkpoint) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }

    return NextResponse.json({ data: checkpoint }, { status: 201 });
  } catch (error) {
    return handleError(error, `POST checkpoints ${(await params).id}`);
  }
}

/** PATCH /api/orchestration/goals/[id]/checkpoints — toggle a checkpoint's completed status. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireAuth(request);
  if (auth) return auth;

  try {
    const { id: _goalId } = await params;
    const body = await request.json();

    if (!body.checkpoint_id && body.checkpoint_id !== 0) {
      return NextResponse.json({ error: "checkpoint_id is required" }, { status: 400 });
    }

    const checkpointId = Number(body.checkpoint_id);
    if (!Number.isFinite(checkpointId)) {
      return NextResponse.json({ error: "checkpoint_id must be a number" }, { status: 400 });
    }

    const checkpoint = goals.toggleCheckpoint(checkpointId);
    if (!checkpoint) {
      return NextResponse.json({ error: "Checkpoint not found" }, { status: 404 });
    }

    return NextResponse.json({ data: checkpoint });
  } catch (error) {
    return handleError(error, `PATCH checkpoints ${(await params).id}`);
  }
}

/** DELETE /api/orchestration/goals/[id]/checkpoints — remove a checkpoint. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireAuth(request);
  if (auth) return auth;

  try {
    const { id: _goalId } = await params;
    const body = await request.json();

    if (!body.checkpoint_id && body.checkpoint_id !== 0) {
      return NextResponse.json({ error: "checkpoint_id is required" }, { status: 400 });
    }

    const checkpointId = Number(body.checkpoint_id);
    if (!Number.isFinite(checkpointId)) {
      return NextResponse.json({ error: "checkpoint_id must be a number" }, { status: 400 });
    }

    const ok = goals.removeCheckpoint(checkpointId);
    if (!ok) {
      return NextResponse.json({ error: "Checkpoint not found" }, { status: 404 });
    }

    return NextResponse.json({ data: { deleted: checkpointId } });
  } catch (error) {
    return handleError(error, `DELETE checkpoints ${(await params).id}`);
  }
}
