// ═══════════════════════════════════════════════════════════════
// GET /api/analytics/timeseries?type=&days=&bucket=day
//
// Daily event counts for the Insights activity chart. `type` (optional) scopes
// to one event type; `days` (1–365, default 30) sets the window. Query params
// are validated with analyticsTimeseriesQuerySchema (parseAndValidateJsonBody
// is body-only, so query validation is done inline here).
// ═══════════════════════════════════════════════════════════════

import { NextRequest } from "next/server";

import { ok } from "@/lib/api/api-response";
import { ensureDb } from "@/lib/db";
import { analyticsTimeseriesQuerySchema, zodErrorResponse } from "@/lib/api/api-schemas";
import { timeseries } from "@/lib/analytics/analytics-repository";
import { route } from "@/lib/api/api-route";

export const GET = route("GET /api/analytics/timeseries", "", "Failed to load analytics timeseries", async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const parsed = analyticsTimeseriesQuerySchema.safeParse({
    type: searchParams.get("type") ?? undefined,
    days: searchParams.get("days") ?? undefined,
    bucket: searchParams.get("bucket") ?? undefined,
  });
  if (!parsed.success) return zodErrorResponse(parsed.error);
  ensureDb();
  const { type, days, bucket } = parsed.data;
  return ok({
    timeseries: timeseries(type ?? null, days),
    type: type ?? null,
    days,
    bucket,
  });
});
