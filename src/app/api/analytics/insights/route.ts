// ═══════════════════════════════════════════════════════════════
// GET /api/analytics/insights?days=N — composed analytics bundle for the
// Insights workbench (hour-of-day, per-category daily, run-duration
// distribution, per-model token/cost, top missions, success-rate trend).
// Read-only; all reads are defensive so an empty DB yields zero-filled data.
// ═══════════════════════════════════════════════════════════════

import { NextRequest } from "next/server";
import { serverErrorFromCatch } from "@/lib/api-logger";
import { ok } from "@/lib/api-response";
import { ensureDb } from "@/lib/db";
import { getInsightsBundle } from "@/lib/analytics/insights-bundle";

export async function GET(request: NextRequest) {
  try {
    ensureDb();
    const raw = Number(request.nextUrl.searchParams.get("days") ?? 30);
    const days = Number.isFinite(raw) ? raw : 30;
    return ok({ insights: getInsightsBundle(days) });
  } catch (error) {
    return serverErrorFromCatch("GET /api/analytics/insights", "", error, "Failed to load insights");
  }
}
