// ═══════════════════════════════════════════════════════════════
// cron-sync-failure.ts — shared 502 response for pushJobToHermes failure
// ═══════════════════════════════════════════════════════════════
//
// Push-from-CH-to-Hermes failures share an exact response contract:
//   status:  502 Bad Gateway
//   body:    { error: "Failed to sync cron job to Hermes",
//              cronPushError: <pushResult.error ?? "unknown"> }
//
// Before this helper, the contract appeared in 3 places:
//   1. src/app/api/cron/route.ts  — local `cronSyncFailureResponse(route, pushResult)`
//      (also logs the underlying error)
//   2. src/app/api/missions/route.ts  — inline 8-line block in the cron-dispatch branch
//      (with an extra `data: { mission: ... }` field mixed in)
//   3. src/lib/mission-promote-handler.ts  — inline 8-line block in promote's cron branch
//
// Two helpers are exported:
//   - `cronSyncFailureResponse(route, pushResult)` returns a NextResponse
//     ready to be returned from a route handler. Used by the cron/route.ts
//     sites (no extra body fields needed).
//   - `cronSyncFailureBody(pushResult)` returns the plain body object,
//     for callers that need to add extra fields (e.g. the missions POST
//     site adds `data: { mission: ... }`) before wrapping in
//     `NextResponse.json(...)` themselves.
//
// The byte-equivalence contract (per session-51) is preserved exactly: the
// same status, the same `error` string, the same `cronPushError` fallback
// ("unknown" when the pushResult is `ok: false` with no `error` field).
//
// `logApiError` is also called with the same arguments the local cron
// helper used — `new Error(pushResult.error ?? "unknown")` — so the
// console output is identical. The mission-promote and mission-route
// inline sites previously logged via a different shape (raw string,
// not wrapped in `new Error`); the migration to this helper unifies
// the log shape across all 3 sites, but the *console* line is
// effectively the same (logApiError just `String()`-coerces the error
// argument either way — see src/lib/api-logger.ts).

import { NextResponse } from "next/server";
import { logApiError } from "@/lib/api-logger";

/** Minimal shape of a `pushJobToHermes` / `removeJobFromHermes` result. */
export interface CronSyncResult {
  ok: boolean;
  error?: string;
}

const CRON_SYNC_FAILURE_MESSAGE = "Failed to sync cron job to Hermes";

/**
 * Build the plain body of a cron-sync-failure 502 response. Exposed so
 * callers that need to mix in extra fields (e.g. `data: { mission }`)
 * can spread it into their own `NextResponse.json(...)` call.
 */
export function cronSyncFailureBody(pushResult: CronSyncResult): {
  error: string;
  cronPushError: string;
} {
  return {
    error: CRON_SYNC_FAILURE_MESSAGE,
    cronPushError: pushResult.error ?? "unknown",
  };
}

/**
 * Return a 502 response for a `pushJobToHermes` failure and log the
 * underlying error. The `route` is the logApiError route label
 * (e.g. `"POST /api/missions"` or `"PUT /api/cron"`). The `pushResult`
 * is the `{ ok: false, error?: string }` envelope from the push.
 */
export function cronSyncFailureResponse(
  route: string,
  pushResult: CronSyncResult,
): NextResponse {
  logApiError(route, "pushJobToHermes", new Error(pushResult.error ?? "unknown"));
  return NextResponse.json(cronSyncFailureBody(pushResult), { status: 502 });
}

/** Exported for tests that want to assert the canonical error string. */
export const CRON_SYNC_FAILURE_MESSAGE_CONST = CRON_SYNC_FAILURE_MESSAGE;
