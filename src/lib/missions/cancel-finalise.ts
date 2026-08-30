// ═══════════════════════════════════════════════════════════════
// cancel-finalise.ts — the one way a cancelled mission is written down
//
// WHY THIS EXISTS. Two entry points cancelled a mission and neither wrote the
// same thing:
//
//   POST /api/missions {action:"cancel"}   cleared queuedForRun and wrote an
//                                          audit line, and reached the RUN row
//                                          only through a background call, and
//                                          only when the mission was dispatched
//   POST /api/missions/[id]/cancel         did neither of the first two
//
// The stranded `queued_for_run = 1` was latent only because
// `getNextQueuedMission` also filters on `status='queued'`; one filter change
// away from a cancelled mission re-dispatching itself. And the missing audit
// line meant a cancel through the REST route left no trace in the one file the
// operator can read back.
//
// It also has to be SYNCHRONOUS with the response. `describeMissionRunState`
// labels a cancellation from `runs.status`, so if the run row were written only
// by a background call the board would say "Failed" for as long as that took.
// The label and this function are one change for that reason (T-0070).
//
// WHAT IS DELIBERATELY NOT HERE: stopping the backend run. That is I/O, it can
// fail, and only one of the two callers needs to await it. Keeping it out means
// the local record is written the same way whether or not the backend answers.
// ═══════════════════════════════════════════════════════════════

import { appendAuditLine } from "@/lib/audit-log";
import { logApiError } from "@/lib/api-logger";
import { updateMission } from "@/lib/missions/mission-repository";
import type { Mission } from "@/lib/missions/mission-types";
import { getLatestRunForMission, updateRun } from "@/lib/runs-repository";
import { closeSessionForMission } from "@/lib/sessions/session-repository";

/**
 * The text every writer uses, so the three tables cannot tell three stories.
 *
 * Module-private on purpose. It is the one WRITER's constant, not a shared
 * vocabulary: the tests assert the literal a reader would actually see, so an
 * accidental edit here shows up as a failing expectation rather than as two
 * sides of the same rename agreeing with each other.
 */
const CANCELLED_BY_USER = "Cancelled by user";

/**
 * Record a cancellation across the mission, its latest run and its session.
 *
 * @param missionId the mission being cancelled
 * @param audit     whether to write the audit line here. The caller that also
 *                  triggers a backend stop passes `true` exactly once — an
 *                  audit inside this function AND at the call site would record
 *                  two cancellations for one click.
 * @returns the updated mission, or null when it vanished under us.
 */
export function finaliseCancelledMission(missionId: string, audit = true): Mission | null {
  const mission = updateMission(missionId, {
    status: "failed",
    result: CANCELLED_BY_USER,
    // The mission enum has no `cancelled` and the operator ruled it stays that
    // way; the run row below is where the distinction is recorded.
    queuedForRun: false,
  });
  if (!mission) return null;

  // Only a run that was actually in flight becomes `cancelled`. A run that had
  // already completed or failed keeps its real ending — a cancellation arriving
  // after the fact did not cause it.
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
      // 143 is SIGTERM, and it is the marker the agent's own `interrupt`
      // end-reason maps to. Both writers now agree on the pair (T-0070).
      exitCode: 143,
      error: CANCELLED_BY_USER,
    });
  } catch (err) {
    logApiError("cancel.finalise", `${missionId} session`, err);
  }

  if (audit) appendAuditLine({ action: "mission.cancel", resource: missionId, ok: true });
  return mission;
}
