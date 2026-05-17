// ═══════════════════════════════════════════════════════════════
// Hermes Kanban API — Get task execution context
// ═══════════════════════════════════════════════════════════════
// GET /api/orchestration/hermes-kanban/[id]/context
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { logApiError } from "../../../../../../lib/api-logger";
import * as bridge from "../../../../../../lib/hermes-kanban-bridge";

function handleError(error: unknown, context: string) {
  logApiError("hermes-kanban", context, error);
  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Request failed" },
    { status: 500 },
  );
}

/** GET /api/orchestration/hermes-kanban/[id]/context — get task workspace/env context. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const ctx = await bridge.getTaskContext(id);
    return NextResponse.json({ data: ctx });
  } catch (error) {
    return handleError(error, `GET [id]/context ${(await params).id}`);
  }
}
