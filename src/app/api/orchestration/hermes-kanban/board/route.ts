// ═══════════════════════════════════════════════════════════════
// Hermes Kanban API — Board summary, boards list, board stats
// ═══════════════════════════════════════════════════════════════
// GET /api/orchestration/hermes-kanban/board
//   ?scope=summary   — aggregated counts by status/assignee
//   ?scope=boards    — list all boards (default)
//   ?scope=stats     — board stats (optional ?board=<slug>)
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

/** GET /api/orchestration/hermes-kanban/board — board information. */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const scope = url.searchParams.get("scope") || "boards";
    const board = url.searchParams.get("board") || undefined;

    switch (scope) {
      case "summary": {
        const summary = bridge.getBoardSummary();
        return NextResponse.json({ data: summary });
      }
      case "stats": {
        const stats = await bridge.getBoardStats(board);
        return NextResponse.json({ data: stats });
      }
      case "boards":
      default: {
        const boards = await bridge.listBoards();
        return NextResponse.json({ data: { boards } });
      }
    }
  } catch (error) {
    return handleError(error, "GET /board");
  }
}
