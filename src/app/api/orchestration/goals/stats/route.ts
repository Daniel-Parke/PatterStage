// ═══════════════════════════════════════════════════════════════
// Goals API — Statistics endpoint
// ═══════════════════════════════════════════════════════════════
// GET  /api/orchestration/goals/stats  — aggregate goal stats
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { logApiError } from "@/lib/api-logger";
import { getGoalStats } from "@/lib/goals-bridge";

export async function GET() {
  try {
    const stats = getGoalStats();
    return NextResponse.json({ data: stats });
  } catch (error) {
    logApiError("GET /api/orchestration/goals/stats", "computing goal stats", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to compute goal stats" },
      { status: 500 },
    );
  }
}
