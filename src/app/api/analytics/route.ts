// ═══════════════════════════════════════════════════════════════
// GET /api/analytics — interaction analytics summary (Insights page)
//
// Read-only aggregate over analytics_events: total + last-30-day counts per
// event type, and distinct active days. Events are emitted server-side via
// recordEvent(), so there is intentionally NO POST here (a client must not be
// able to forge achievement progress).
// ═══════════════════════════════════════════════════════════════

import { serverErrorFromCatch } from "@/lib/api-logger";
import { ok } from "@/lib/api-response";
import { ensureDb } from "@/lib/db";
import { getAnalyticsSummary } from "@/lib/analytics/aggregates";

export async function GET() {
  try {
    ensureDb();
    return ok({ analytics: getAnalyticsSummary() });
  } catch (error) {
    return serverErrorFromCatch("GET /api/analytics", "", error, "Failed to load analytics");
  }
}
