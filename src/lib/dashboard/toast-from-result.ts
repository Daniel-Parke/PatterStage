// ═══════════════════════════════════════════════════════════════
// toastFromResult — Centralised "ok ? success : error" toast helper
// ═══════════════════════════════════════════════════════════════
//
// The pattern `showToast(ok ? success : (error ?? fallback), ok ? undefined : "error")`
// repeats across every caller that mutates through the API: today
// useMissionDispatch, useMissionTemplateActions, useHindsightDirectives,
// hindsight-mutate, success-message-for-dispatch and the dashboard page.
// (It once named useCronJobs and useSystemCronJobs; neither has existed for
// some time, which is the sort of drift a comment cannot be trusted to notice.)
// Centralising it here:
//   1. locks the showToast contract (success uses default tone, error uses "error")
//   2. makes the per-call error fallback the only knob — no risk of a caller
//      forgetting the `"error"` tone on the failure branch
//   3. removes the `ok ? undefined : "error"` argument-pile at every site
//
// Byte-equivalent to the prior inline form for all current call sites.

/**
 * Minimal shape required by {@link toastFromResult}. Matches the
 * `{ ok, error? }` shape returned by `safeApiCall` from `@/lib/api-fetch`.
 */
export interface SafeCallResult {
  ok: boolean;
  error?: string | null;
}

type ShowToast = (message: string, tone?: "success" | "error" | "info") => void;

/**
 * Show a toast based on a `safeApiCall`-style result.
 *
 * The `successMsg` can be a static string (the common case) or a
 * function returning a string. The function form is for handlers
 * where the success message depends on a mode/state that the caller
 * has already computed (e.g. dispatch mode → "Mission dispatched"
 * vs. "Mission scheduled: cron_5min"). It's called lazily only on
 * the success path, so the message-construction cost is paid once.
 *
 * @param showToast the `useToast()` return value
 * @param result `{ ok, error? }` from `safeApiCall`
 * @param successMsg shown when `result.ok === true`; may be a
 *   string (always evaluated) or a function returning a string
 *   (called only on success)
 * @param errorFallback shown when `result.ok === false` and `result.error` is missing
 */
export function toastFromResult(
  showToast: ShowToast,
  result: SafeCallResult,
  successMsg: string | (() => string),
  errorFallback: string,
): void {
  if (result.ok) {
    showToast(typeof successMsg === "function" ? successMsg() : successMsg);
  } else {
    showToast(result.error ?? errorFallback, "error");
  }
}
