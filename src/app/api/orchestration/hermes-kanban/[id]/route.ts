// ═══════════════════════════════════════════════════════════════
// Hermes Kanban API — Task detail, edit, and archive
// ═══════════════════════════════════════════════════════════════
// GET    /api/orchestration/hermes-kanban/[id]     — get task detail
// PATCH  /api/orchestration/hermes-kanban/[id]     — edit task
// DELETE /api/orchestration/hermes-kanban/[id]     — archive task
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "../../../../../lib/api-auth";
import { logApiError } from "../../../../../lib/api-logger";
import * as bridge from "../../../../../lib/hermes-kanban-bridge";

function handleError(error: unknown, context: string) {
  logApiError("hermes-kanban", context, error);
  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Request failed" },
    { status: 500 },
  );
}

/** GET /api/orchestration/hermes-kanban/[id] — get full task detail. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const task = bridge.getTask(id);
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    return NextResponse.json({ data: task });
  } catch (error) {
    return handleError(error, `GET [id] ${(await params).id}`);
  }
}

/** PATCH /api/orchestration/hermes-kanban/[id] — edit task result/summary/metadata. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireAuth(request);
  if (auth) return auth;

  try {
    const { id } = await params;
    const body = await request.json();
    const { result, summary, metadata } = body;

    await bridge.editTask(id, { result, summary, metadata });
    return NextResponse.json({ data: { id, updated: true } });
  } catch (error) {
    return handleError(error, `PATCH [id] ${(await params).id}`);
  }
}

/** DELETE /api/orchestration/hermes-kanban/[id] — archive a task. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireAuth(request);
  if (auth) return auth;

  try {
    const { id } = await params;
    await bridge.archiveTask(id);
    return NextResponse.json({ data: { id, archived: true } });
  } catch (error) {
    return handleError(error, `DELETE [id] ${(await params).id}`);
  }
}
