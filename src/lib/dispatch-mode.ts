// ═══════════════════════════════════════════════════════════════
// dispatch-mode — centralise the 4-way dispatch-mode decomposition
// ═══════════════════════════════════════════════════════════════
//
// The 4 boolean flags derived from a `dispatchMode` value
// (`isSaveMode`, `isQueueMode`, `isCronMode`, `isNowMode`) were
// recomputed verbatim in 2 places:
//
//   • src/app/api/missions/route.ts:286-288  (server dispatch path)
//   • src/lib/mission-promote-handler.ts:79-82  (server promote path)
//
// and the canonical type alias was duplicated in
// `src/hooks/success-message-for-dispatch.ts`. The server-side
// `isCronMode` is the strictest form (`dispatchMode === "cron" && schedule`)
// — `schedule` must be a non-empty string for the cron branch to fire.
// The client-side `successMessageForDispatch` re-uses the same mode
// union but doesn't need the `schedule` gate (the client decides
// whether the user is allowed to submit without a schedule separately).
//
// Centralising the union + the 4-flag decomposition lets:
//
//   1. A future "draft" or "scheduled-draft" mode land in one place
//      (every consumer picks up the new branch automatically).
//   2. The `isCronMode` truthiness rule (and the missing-schedule error
//      message) live in one place — a future "Schedule is required for
//      cron dispatch" message can change in one spot.
//   3. The `DispatchMode` type become the single canonical name. The
//      prior `src/hooks/success-message-for-dispatch.ts` re-export is
//      kept for back-compat (1 inline consumer in `useMissionsPage.ts`)
//      but the new helper imports its type from this file directly.
// ═══════════════════════════════════════════════════════════════

/**
 * The 4 supported mission dispatch modes. The union is closed — adding
 * a new mode (e.g. `"scheduled-draft"`) requires updating every site
 * that switches on `dispatchMode`, and the compiler will guide the
 * author to each one.
 */
export type DispatchMode = "save" | "now" | "cron" | "queue";

/**
 * The 4 boolean decompositions of a `dispatchMode` value, plus a
 * `valid` flag that is `true` only when the mode is one of the 4
 * supported values.
 *
 * The `schedule` parameter controls the `isCronMode` flag: a cron
 * dispatch without a schedule is not a cron dispatch (the server-side
 * `isCronMode` predicate has always been `dispatchMode === "cron" &&
 * schedule`). Pass an empty/undefined schedule to suppress the cron
 * branch (the caller can then surface a "schedule is required" error).
 *
 * @param dispatchMode The dispatch mode from the API body.
 * @param schedule    The cron schedule expression, if any. Falsy
 *   (`""` or `undefined`) suppresses the `isCronMode` flag.
 */
export function parseDispatchMode(
  dispatchMode: string | undefined,
  schedule?: string,
): { isSaveMode: boolean; isQueueMode: boolean; isCronMode: boolean; isNowMode: boolean; valid: boolean } {
  const isSaveMode = dispatchMode === "save";
  const isQueueMode = dispatchMode === "queue";
  const isCronMode = dispatchMode === "cron" && !!schedule;
  const isNowMode = dispatchMode === "now";
  const valid = isSaveMode || isQueueMode || isNowMode || isCronMode;
  return { isSaveMode, isQueueMode, isCronMode, isNowMode, valid };
}

/**
 * Resolve the schedule field for a dispatch payload. The schedule is
 * only meaningful when the dispatch mode is "cron" — every other
 * mode returns `undefined` so the field is omitted from the API
 * payload entirely. Centralises the
 *
 *   schedule: dispatchMode === "cron" ? schedule : undefined
 *
 * pattern that appeared in 3 sites in `useMissionsPage.ts` (the 3
 * `dispatchPayload` overrides that merge a `schedule` field).
 *
 * @param dispatchMode The dispatch mode (one of `DispatchMode`).
 * @param schedule     The cron schedule expression, if any.
 * @returns `schedule` when `dispatchMode === "cron"`, `undefined` otherwise.
 */
export function scheduleForDispatch(
  dispatchMode: DispatchMode,
  schedule?: string,
): string | undefined {
  return dispatchMode === "cron" ? schedule : undefined;
}
