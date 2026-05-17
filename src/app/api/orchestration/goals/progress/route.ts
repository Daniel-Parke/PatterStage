// ═══════════════════════════════════════════════════════════════
// Goals API — Aggregate progress endpoint
// ═══════════════════════════════════════════════════════════════
// GET  /api/orchestration/goals/progress  — aggregate progress across all goals
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { logApiError } from "@/lib/api-logger";
import { listGoals, getGoal } from "@/lib/goals-bridge";

interface GoalProgressItem {
  id: string;
  title: string;
  status: string;
  priority: number;
  category: string | null;
  checkpoints_total: number;
  checkpoints_done: number;
  progress_pct: number;
}

interface AggregateProgress {
  goals: GoalProgressItem[];
  total_goals: number;
  completed_goals: number;
  in_progress_goals: number;
  active_goals: number;
  overall_progress_pct: number;
  by_category: Record<string, { total: number; completed: number; progress_pct: number }>;
}

export async function GET() {
  try {
    const all = listGoals();
    const details = all.map((g) => getGoal(g.id)).filter(Boolean);

    const goalsList: GoalProgressItem[] = (details as NonNullable<ReturnType<typeof getGoal>>[]).map((g) => ({
      id: g.id,
      title: g.title,
      status: g.status,
      priority: g.priority,
      category: g.category,
      checkpoints_total: g.checkpoints.length,
      checkpoints_done: g.checkpoints.filter((c) => c.completed === 1).length,
      progress_pct: g.progress_pct,
    }));

    const completed = goalsList.filter((g) => g.status === "completed");
    const inProgress = goalsList.filter((g) => g.status === "in_progress");
    const active = goalsList.filter((g) => g.status === "active");

    const totalProgress = goalsList.reduce((sum, g) => sum + g.progress_pct, 0);
    const overallPct = goalsList.length > 0 ? Math.round(totalProgress / goalsList.length) : 0;

    // Per-category aggregation
    const byCategory: Record<string, { total: number; completed: number; progress_pct: number }> = {};
    for (const g of goalsList) {
      const cat = g.category || "__uncategorized__";
      if (!byCategory[cat]) {
        byCategory[cat] = { total: 0, completed: 0, progress_pct: 0 };
      }
      byCategory[cat].total++;
      if (g.status === "completed") byCategory[cat].completed++;
    }
    for (const cat of Object.keys(byCategory)) {
      const catGoals = goalsList.filter((g) => (g.category || "__uncategorized__") === cat);
      const catProgress = catGoals.reduce((s, g) => s + g.progress_pct, 0);
      byCategory[cat].progress_pct = catGoals.length > 0 ? Math.round(catProgress / catGoals.length) : 0;
    }

    const result: AggregateProgress = {
      goals: goalsList,
      total_goals: goalsList.length,
      completed_goals: completed.length,
      in_progress_goals: inProgress.length,
      active_goals: active.length,
      overall_progress_pct: overallPct,
      by_category: byCategory,
    };

    return NextResponse.json({ data: result });
  } catch (error) {
    logApiError("GET /api/orchestration/goals/progress", "computing aggregate progress", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to compute progress" },
      { status: 500 },
    );
  }
}
