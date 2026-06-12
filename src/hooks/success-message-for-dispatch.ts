// ═══════════════════════════════════════════════════════════════
// successMessageForDispatch — mode → success-toast string resolver
// ═══════════════════════════════════════════════════════════════
//
// The `handleSubmit` callback in `useMissionsPage.ts` has two branches
// (the promote path + the dispatch path) that each need a different
// success toast string depending on the dispatch mode. Pre-refactor
// the 4-branch resolver was duplicated inline in both places:
//
//   if (mode === "save") return "Mission saved as draft";
//   if (mode === "queue") return "Mission saved to queue";
//   if (mode === "now") return "Mission dispatched";
//   return `Mission scheduled: ${schedule}`;
//
// Extracted to a helper so a future "renamed string" or "new mode"
// change lands in one place. The 4 strings are the ones the 2 inline
// resolvers used — byte-equivalent at the call site.
//
// Location: src/hooks/ (page-local helper, not promoted to src/lib/
// because no other consumer exists; if a 2nd consumer appears, move
// to src/lib/ alongside the toastFromResult helper).
//
// The `DispatchMode` type is re-exported for back-compat with the 1
// inline consumer (`useMissionsPage.ts` imports `DispatchMode` from
// here). The canonical type lives in `src/lib/dispatch-mode.ts`, which
// is the single source of truth for the union and the parsing helper.

export type { DispatchMode } from "@/lib/dispatch-mode";
import type { DispatchMode } from "@/lib/dispatch-mode";
import type { SafeApiCallResult } from "@/lib/api-fetch";
import { safeApiCall } from "@/lib/api-fetch";

/**
 * Envelope shape for the `/api/missions` POST route. Every action
 * returns `{ data: { mission: { id: string, ... } } }` on success.
 * Extracted to a top-level type so the `dispatchMissionAction`
 * helper in this file can express the response shape without
 * inlining it 4 times across the call sites in
 * `useMissionsPage.handleCreate`.
 */
export interface MissionActionResponse {
  data?: { mission?: { id: string } & Record<string, unknown> };
}

/**
 * POST a `{ action, ...body }` envelope to `/api/missions` and return
 * the safe-typed result. The 4 call sites in `useMissionsPage.handleCreate`
 * (update / promote / redispatch-completed / dispatch-new) all share the
 * exact same shape: a POST with `{ action, missionId?, name, ...payload }`
 * and a typed `SafeApiCallResult<MissionActionResponse>` return.
 *
 * Centralising the call shape has 3 wins:
 *  1. The envelope type (`MissionActionResponse`) is declared once
 *     instead of inlined 4 times.
 *  2. Future migrations to a different safe-call wrapper (e.g.
 *     `safeApiCallData`) only need to touch this helper.
 *  3. The 4 sites collapse to a 4-line call each (action + body + helper
 *     invocation + destructure) instead of a 12-line call with the
 *     envelope type and method/body boilerplate.
 *
 * Byte-equivalence: the helper body is literally
 * `safeApiCall<MissionActionResponse>("/api/missions", { method: "POST", body: { action, ...body } })`
 * — same wire call, same `{ data: { mission: { id } } }` envelope, same
 * `SafeApiCallResult` shape on return. The 4 callers each spread their
 * own body shape (e.g. `{ missionId, name, ...dispatchPayload(...) }`)
 * into the helper — no shape change at the call site.
 */
export function dispatchMissionAction(
  action: "dispatch" | "update" | "promote" | "delete" | "cancel",
  body: Record<string, unknown>,
): Promise<SafeApiCallResult<MissionActionResponse>> {
  return safeApiCall<MissionActionResponse>("/api/missions", {
    method: "POST",
    body: { action, ...body },
  });
}

/**
 * Resolve the success toast message for a dispatched mission based on
 * the dispatch mode.
 *
 *   save  → "Mission saved as draft"
 *   queue → "Mission saved to queue"
 *   now   → "Mission dispatched"
 *   cron  → `Mission scheduled: ${schedule}` (falls through)
 *
 * @param mode The dispatch mode chosen by the user.
 * @param schedule The cron expression, required when `mode === "cron"`.
 *   When `undefined` or `""` is passed, the helper produces the same
 *   pre-refactor template-literal output ("Mission scheduled: undefined"
 *   or "Mission scheduled: "). No special-casing — matches the inline form.
 */
export function successMessageForDispatch(
  mode: DispatchMode,
  schedule?: string,
): string {
  if (mode === "save") return "Mission saved as draft";
  if (mode === "queue") return "Mission saved to queue";
  if (mode === "now") return "Mission dispatched";
  return `Mission scheduled: ${schedule}`;
}
