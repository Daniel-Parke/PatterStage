// cancel-finalise.ts — the one way a cancelled mission is written down.
//
// Two entry points cancelled a mission and wrote different things: the action
// route cleared queuedForRun and wrote an audit line but reached the RUN row
// only through a background call; the REST route did neither. The stranded
// `queued_for_run = 1` was one filter change away from re-dispatching a
// cancelled mission, and the REST cancel left no audit trace. It is
// SYNCHRONOUS with the response: `describeMissionRunState` labels a
// cancellation from `runs.status`, so a background write would show "Failed"
// meanwhile; label and function are one change (T-0070). Stopping the backend
// run is deliberately NOT here: it is I/O that can fail, and only one caller awaits it.

import { appendAuditLine } from "@/lib/api/audit-log";
import { logApiError } from "@/lib/api/api-logger";
import { updateMission } from "@/lib/missions/mission-repository";
import type { Mission } from "@/lib/missions/mission-types";
import { getLatestRunForMission, updateRun } from "@/lib/runs/runs-repository";
import { closeSessionForMission } from "@/lib/sessions/session-repository";

/**
 * The text every writer uses, so three tables cannot tell three stories.
 * Module-private: tests assert the literal a reader sees, so an edit here
 * fails an expectation rather than two sides of one rename agreeing.
 */
const CANCELLED_BY_USER = "Cancelled by user";

/**
 * Record a cancellation across mission, latest run and session.
 * @param missionId the mission being cancelled
 * @param audit     whether to write the audit line here; the caller that also
 *                  stops the backend passes `true` once, or one click records two.
 * @returns the updated mission, or null when it vanished under us.
 */
export function finaliseCancelledMission(missionId: string, audit = true): Mission | null {
  const mission = updateMission(missionId, {
    status: "failed",
    result: CANCELLED_BY_USER,
    // No `cancelled` in the mission enum, by the operator's ruling; the run row records it.
    queuedForRun: false,
  });
  if (!mission) return null;

  // Only a run in flight becomes `cancelled`; one already ended keeps its real ending.
  try {
    const run = getLatestRunForMission(missionId);
    if (run && run.status === "started") {
      updateRun(run.id, { status: "cancelled", error: CANCELLED_BY_USER });
    }
  } catch (err) {
    logApiError("cancel.finalise", `${missionId} run row`, err);
  }

  try {
    closeSessionForMission(missionId, {
      status: "failed",
      endedAt: new Date().toISOString(),
      // 143 is SIGTERM, the marker the agent's `interrupt` end-reason maps to (T-0070).
      exitCode: 143,
      error: CANCELLED_BY_USER,
    });
  } catch (err) {
    logApiError("cancel.finalise", `${missionId} session`, err);
  }

  if (audit) appendAuditLine({ action: "mission.cancel", resource: missionId, ok: true });
  return mission;
}
