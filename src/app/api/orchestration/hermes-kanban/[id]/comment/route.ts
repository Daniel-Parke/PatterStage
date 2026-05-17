// ═══════════════════════════════════════════════════════════════
// Hermes Kanban API — Add a comment to a task
// ═══════════════════════════════════════════════════════════════
// POST /api/orchestration/hermes-kanban/[id]/comment
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

/** POST /api/orchestration/hermes-kanban/[id]/comment — add a comment. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireAuth(request);
  if (auth) return auth;

  try {
    const { id } = await params;
    const body = await request.json();
    const { text } = body as { text: string };

    if (!text) {
      return NextResponse.json(
        { error: "text is required" },
        { status: 400 },
      );
    }
    await bridge.addComment(id, text);
    return NextResponse.json({ data: { id, comment_added: true } });
  } catch (error) {
    return handleError(error, `POST [id]/comment ${(await params).id}`);
  }
}
