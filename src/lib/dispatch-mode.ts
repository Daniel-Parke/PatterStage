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
 * The legal modes as a runtime value.
 *
 * `DispatchMode` is erased at compile time, so a server reading an untrusted
 * body cannot check against it. Without a runtime list the only validation was
 * `parseDispatchMode`'s `valid` flag, which the dispatch route computed and
 * discarded, and unrecognised modes fell into an immediate unattended run
 * (T-0067). Exported so a refusal can also NAME the legal values: an operator
 * who typed "schedule" previously got no hint what to type instead.
 *
 * Kept beside the type on purpose. A `satisfies` check means adding a mode to
 * one and not the other is a compile error rather than a silent gap.
 */
export const DISPATCH_MODES = ["save", "now", "cron", "queue"] as const satisfies readonly DispatchMode[];

/**
 * Narrow an untrusted value to a `DispatchMode`.
 *
 * For the boundaries that STORE a mode rather than act on one: a template
 * persists whatever it is handed, and the composer casts it straight back into
 * form state, so an unvalidated write there is a delayed-action version of the
 * same defect (T-0067).
 */
export function isDispatchMode(value: unknown): value is DispatchMode {
  return typeof value === "string" && (DISPATCH_MODES as readonly string[]).includes(value);
}

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
/** The one place that decides which modes carry a schedule at all. */
function sendsSchedule(dispatchMode: DispatchMode): boolean {
  return dispatchMode === "cron";
}

export function scheduleForDispatch(
  dispatchMode: DispatchMode,
  schedule?: string,
): string | undefined {
  return sendsSchedule(dispatchMode) ? schedule : undefined;
}

/**
 * Should this dispatch be refused because the schedule field holds something
 * unusable?
 *
 * Twinned deliberately with `scheduleForDispatch` above and sharing one
 * predicate, so the set of modes that CARRY a schedule and the set that can be
 * BLOCKED by a bad one cannot drift apart. A test iterates every DispatchMode
 * and asserts the two agree; without that, teaching one a new mode and
 * forgetting the other silently reopens T-0063.
 *
 * Returns the message to show, or null when there is nothing to refuse.
 */
export function scheduleBlocksDispatch(
  dispatchMode: DispatchMode,
  draftError: string | null,
): string | null {
  return sendsSchedule(dispatchMode) ? draftError : null;
}
