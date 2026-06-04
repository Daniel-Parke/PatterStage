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
// Three helpers are exported:
//   - `cronSyncFailureResponse(route, pushResult)` returns a NextResponse
//     ready to be returned from a route handler. Used by the cron/route.ts
//     sites (no extra body fields needed).
//   - `cronSyncFailureBody(pushResult)` returns the plain body object,
//     for callers that need to add extra fields (e.g. the missions POST
//     site adds `data: { mission: ... }`) before wrapping in
//     `NextResponse.json(...)` themselves.
//   - `logCronSyncFailure(route, pushResult)` logs the underlying error
//     via the canonical `logApiError` shape WITHOUT producing a response.
//     Use this when the caller needs to splice extra body fields (so
//     `cronSyncFailureResponse`'s NextResponse is unusable) but still
//     wants the same console-log line as the cron/route.ts sites. Pairs
//     with `cronSyncFailureBody` for the response payload.
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

/**
 * Log a `pushJobToHermes` failure via the canonical `logApiError` shape
 * without producing a response. Use this in callers that need to splice
 * extra body fields into the 502 (e.g. `data: { mission: ... }`) and
 * therefore can't return `cronSyncFailureResponse`'s NextResponse
 * directly — pairing this helper with `cronSyncFailureBody` keeps the
 * console-log line identical to the cron/route.ts sites and the wire
 * shape locked to the canonical body. Previously these callers misused
 * `cronSyncFailureResponse` for its side effect (logging) and discarded
 * the returned NextResponse, which is misleading — a reader scanning
 * the call site would expect the response to be returned.
 *
 * Byte-equivalent to the inline `logApiError(route, "pushJobToHermes",
 * new Error(pushResult.error ?? "unknown"))` call embedded in
 * `cronSyncFailureResponse`. The "?? unknown" fallback matches the
 * canonical pusher-result error shape.
 */
export function logCronSyncFailure(
  route: string,
  pushResult: CronSyncResult,
): void {
  logApiError(route, "pushJobToHermes", new Error(pushResult.error ?? "unknown"));
}

/** Exported for tests that want to assert the canonical error string. */
export const CRON_SYNC_FAILURE_MESSAGE_CONST = CRON_SYNC_FAILURE_MESSAGE;
