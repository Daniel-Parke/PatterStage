// ═══════════════════════════════════════════════════════════════
// Hermes Kanban API — Dispatch (nudge the dispatcher)
// ═══════════════════════════════════════════════════════════════
// POST /api/orchestration/hermes-kanban/dispatch
//   body: { max?: number }  — optional max tasks to dispatch
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

/** POST /api/orchestration/hermes-kanban/dispatch — nudge the dispatcher. */
export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

  try {
    const body = await request.json().catch(() => ({}));
    const { max } = body as { max?: number };

    await bridge.dispatchNow(max);
    return NextResponse.json({ data: { dispatched: true, max: max ?? null } });
  } catch (error) {
    return handleError(error, "POST /dispatch");
  }
}
