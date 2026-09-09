// ═══════════════════════════════════════════════════════════════
// GET /api/analytics — interaction analytics summary (Insights page)
//
// Read-only aggregate over analytics_events: total + last-30-day counts per
// event type, and distinct active days. Events are emitted server-side via
// recordEvent(), so there is intentionally NO POST here (a client must not be
// able to forge achievement progress).
// ═══════════════════════════════════════════════════════════════

import { ok } from "@/lib/api-response";
import { ensureDb } from "@/lib/db";
import { getAnalyticsSummary } from "@/lib/analytics/aggregates";
import { route } from "@/lib/api-route";

export const GET = route("GET /api/analytics", "", "Failed to load analytics", async () => {
  ensureDb();
  return ok({ analytics: getAnalyticsSummary() });
});
