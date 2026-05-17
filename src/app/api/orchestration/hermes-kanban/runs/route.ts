// ═══════════════════════════════════════════════════════════════
// Hermes Kanban API — List task runs
// ═══════════════════════════════════════════════════════════════
// GET /api/orchestration/hermes-kanban/runs
//   ?task=<id>    — filter by task
//   ?outcome=...  — filter by outcome
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { logApiError } from "../../../../../lib/api-logger";
import * as bridge from "../../../../../lib/hermes-kanban-bridge";

function handleError(error: unknown, context: string) {
  logApiError("hermes-kanban", context, error);
  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Request failed" },
    { status: 500 },
  );
}

/** GET /api/orchestration/hermes-kanban/runs — list runs with optional filters. */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const taskId = url.searchParams.get("task") || undefined;
    const outcome = url.searchParams.get("outcome") || undefined;

    const runs = await bridge.listRuns(taskId, outcome);
    return NextResponse.json({ data: { runs, total: runs.length } });
  } catch (error) {
    return handleError(error, "GET /runs");
  }
}
