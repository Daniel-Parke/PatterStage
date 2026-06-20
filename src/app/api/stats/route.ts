// ═══════════════════════════════════════════════════════════════
// GET /api/stats — dashboard + gamification stats
//
// One read-only aggregate over the PatterStage DB. Powers the command-center
// dashboard (vitals, throughput, activity heatmap, streak/level, achievements).
// ═══════════════════════════════════════════════════════════════

import { serverErrorFromCatch } from "@/lib/api-logger";
import { ok } from "@/lib/api-response";
import { ensureDb } from "@/lib/db";
import { getDashboardStats } from "@/lib/stats/stats-repository";

export async function GET() {
  try {
    ensureDb();
    return ok({ stats: getDashboardStats() });
  } catch (error) {
    return serverErrorFromCatch("GET /api/stats", "", error, "Failed to load stats");
  }
}
