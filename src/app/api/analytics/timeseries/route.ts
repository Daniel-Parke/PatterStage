// ═══════════════════════════════════════════════════════════════
// GET /api/analytics/timeseries?type=&days=&bucket=day
//
// Daily event counts for the Insights activity chart. `type` (optional) scopes
// to one event type; `days` (1–365, default 30) sets the window. Query params
// are validated with analyticsTimeseriesQuerySchema (parseAndValidateJsonBody
// is body-only, so query validation is done inline here).
// ═══════════════════════════════════════════════════════════════

import { NextRequest } from "next/server";

import { serverErrorFromCatch } from "@/lib/api-logger";
import { ok } from "@/lib/api-response";
import { ensureDb } from "@/lib/db";
import { analyticsTimeseriesQuerySchema, zodErrorResponse } from "@/lib/api-schemas";
import { timeseries } from "@/lib/analytics/analytics-repository";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const parsed = analyticsTimeseriesQuerySchema.safeParse({
    type: searchParams.get("type") ?? undefined,
    days: searchParams.get("days") ?? undefined,
    bucket: searchParams.get("bucket") ?? undefined,
  });
  if (!parsed.success) return zodErrorResponse(parsed.error);

  try {
    ensureDb();
    const { type, days, bucket } = parsed.data;
    return ok({
      timeseries: timeseries(type ?? null, days),
      type: type ?? null,
      days,
      bucket,
    });
  } catch (error) {
    return serverErrorFromCatch(
      "GET /api/analytics/timeseries",
      "",
      error,
      "Failed to load analytics timeseries",
    );
  }
}
