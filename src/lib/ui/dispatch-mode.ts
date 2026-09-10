// dispatch-mode — the 4-way dispatch-mode decomposition, in one place.

/** Closed union: adding a mode means updating every site that switches on `dispatchMode`; the compiler finds them. */
export type DispatchMode = "save" | "now" | "cron" | "queue";

/**
 * The legal modes at runtime: `DispatchMode` is erased, the dispatch route
 * discarded `parseDispatchMode`'s `valid` flag, and unrecognised modes fell
 * into an immediate unattended run (T-0067). Exported so a refusal can NAME the
 * legal values; `satisfies` makes adding a mode to one list only a compile error.
 */
export const DISPATCH_MODES = ["save", "now", "cron", "queue"] as const satisfies readonly DispatchMode[];

/**
 * For the boundaries that STORE a mode: a template persists what it is handed
 * and the composer casts it back into form state, the same defect delayed (T-0067).
 */
export function isDispatchMode(value: unknown): value is DispatchMode {
  return typeof value === "string" && (DISPATCH_MODES as readonly string[]).includes(value);
}

/**
 * The 4 boolean decompositions plus `valid`. A cron dispatch without a schedule is not one.
 * @param dispatchMode The dispatch mode from the API body.
 * @param schedule    The cron expression, if any; falsy suppresses `isCronMode`.
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

/** The one place that decides which modes carry a schedule at all. */
function sendsSchedule(dispatchMode: DispatchMode): boolean {
  return dispatchMode === "cron";
}

/** The schedule for a dispatch payload: only "cron" carries one; other modes get `undefined` so the field is omitted. */
export function scheduleForDispatch(
  dispatchMode: DispatchMode,
  schedule?: string,
): string | undefined {
  return sendsSchedule(dispatchMode) ? schedule : undefined;
}

/**
 * The message refusing a dispatch over an unusable schedule, or null. Shares
 * `sendsSchedule` with `scheduleForDispatch` so the modes that CARRY a schedule
 * and the modes a bad one BLOCKS cannot drift (a test asserts they agree; T-0063).
 */
export function scheduleBlocksDispatch(
  dispatchMode: DispatchMode,
  draftError: string | null,
): string | null {
  return sendsSchedule(dispatchMode) ? draftError : null;
}
