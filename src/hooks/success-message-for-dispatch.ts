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

export type DispatchMode = "save" | "now" | "cron" | "queue";

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
