// ═══════════════════════════════════════════════════════════════
// The mission write, and what it says
// ═══════════════════════════════════════════════════════════════
//
// `dispatchMission` is `runWrite` for POST /api/missions: the action goes in
// the envelope, the route's `{ data: { mission } }` comes back unwrapped, so
// a caller reads `mission?.id` in one step. `successMessageForDispatch` is
// the one resolver for what a dispatch says, so a renamed string or a new
// mode lands in one place.

export type { DispatchMode } from "@/lib/dispatch-mode";
import type { DispatchMode } from "@/lib/dispatch-mode";
import { runWrite, type RunWriteOptions } from "@/lib/api-write";

/** What /api/missions answers with, inside `data`. */
export interface MissionActionPayload {
  mission?: { id: string } & Record<string, unknown>;
}

export type MissionAction = "dispatch" | "update" | "promote" | "delete" | "cancel";

/**
 * Write one mission action. Resolves to the payload on success and to
 * nothing otherwise; the words and the reload are the caller's, said once.
 */
export async function dispatchMission(
  action: MissionAction,
  body: Record<string, unknown>,
  words: Pick<RunWriteOptions<{ data?: MissionActionPayload }>, "showToast" | "successMessage" | "errorMessage" | "setBusy" | "onError">,
): Promise<MissionActionPayload | undefined> {
  const res = await runWrite<{ data?: MissionActionPayload }>({
    ...words,
    url: "/api/missions",
    method: "POST",
    body: { action, ...body },
  });
  return res === undefined ? undefined : (res.data ?? {});
}

/**
 * Resolve the success toast message for a dispatched mission based on
 * the dispatch mode.
 *
 *   save  → "Mission saved as draft"
 *   queue → "Mission saved to queue"
 *   now   → "Mission dispatched"
 *   cron  → `Mission scheduled: ${schedule}` (falls through)
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
