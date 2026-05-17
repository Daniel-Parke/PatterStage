// ═══════════════════════════════════════════════════════════════
// Goals API — Main listing + creation endpoints
// ═══════════════════════════════════════════════════════════════
// GET  /api/orchestration/goals        — list goals
// POST /api/orchestration/goals        — create goal
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

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const result = goals.listGoals({
      status: url.searchParams.get("status") || undefined,
      category: url.searchParams.get("category") || undefined,
      priority: url.searchParams.get("priority") ? Number(url.searchParams.get("priority")) : undefined,
      limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined,
    });
    return NextResponse.json({ data: { goals: result, total: result.length } });
  } catch (error) {
    return handleError(error, "GET /api/orchestration/goals");
  }
}

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

  try {
    const body = await request.json();
    const goal = goals.createGoal({
      title: body.title,
      description: body.description,
      priority: body.priority,
      category: body.category,
      mission_id: body.mission_id,
      parent_goal_id: body.parent_goal_id,
    });
    return NextResponse.json({ data: goal });
  } catch (error) {
    return handleError(error, "POST /api/orchestration/goals");
  }
}
