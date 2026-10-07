// ═══════════════════════════════════════════════════════════════
// orchestration/dispatch.ts — turn a mission into a running agent run
//
// Replaces the old two-phase bash dispatch (mission-dispatch.ts +
// backends/hermes.ts). A mission becomes an HTTP run via runtime.submitRun():
// no bash wrapper, no pid/status files, no stdout parsing for the session id.
// The run row + a pre-registered session row track lifecycle; RunSync
// reconciles them by polling the runtime.
// ═══════════════════════════════════════════════════════════════

import { getMission, reserveMissionRun } from "@/lib/missions/mission-repository";
import {
  acknowledgeMissionSubmission,
  failMissionSubmissionIfActive,
  getRun,
  listCancelledBackendRunsForMission,
  markMissionSubmissionUnconfirmedIfActive,
} from "@/lib/runs/runs-repository";
import { createSession, closeSessionForMission } from "@/lib/sessions/session-repository";
import { runtime } from "@/lib/runtime";
import { now } from "@/lib/db";
import { messageFromError } from "@/lib/api/api-fetch";
import { logApiError } from "@/lib/api/api-logger";
import { recordEvent } from "@/lib/analytics/record-event";
import { UNCONFIRMED_SUBMISSION_RESULT } from "@/lib/missions/mission-claim-state";

export interface DispatchResult {
  ok: boolean;
  /** PatterStage-owned run id (the Idempotency-Key sent to the backend). */
  runId?: string;
  /** Backend-assigned run id. */
  backendRunId?: string;
  sessionId?: string;
  error?: string;
}

/**
 * Dispatch a mission as a single agent run. `runId` may be supplied by the
 * scheduler (so the run row was already inserted under a unique guard for
 * exactly-once); otherwise one is generated here.
 */
export async function dispatchMissionRun(
  missionId: string,
  opts: { runId?: string; scheduleId?: string } = {},
): Promise<DispatchResult> {
  const mission = getMission(missionId);
  if (!mission) return { ok: false, error: "mission not found" };

  const reservedRun = opts.runId ? getRun(opts.runId) : null;
  const claim = opts.runId
    ? reservedRun?.missionId === missionId &&
      reservedRun.status === "started" && mission.status === "dispatched"
      ? { kind: "claimed" as const, runId: opts.runId }
      : { kind: "none" as const }
    : reserveMissionRun({ kind: "attended", missionId, scheduleId: opts.scheduleId });
  if (claim.kind !== "claimed") return { ok: false, error: "mission is no longer available for dispatch" };
  const runId = claim.runId;
  let backendRunId: string | null = null;
  let submissionAttempted = false;

  try {
    // Pre-register an active session row so the dashboard shows the live run.
    const session = createSession({
      source: "mission",
      missionId,
      profileName: mission.profileName ?? null,
      modelId: mission.modelId ?? null,
      provider: mission.provider ?? null,
      title: mission.name,
    });
    if (getRun(runId)?.status !== "started" || getMission(missionId)?.status !== "dispatched") {
      closeSessionForMission(missionId, {
        status: "failed", endedAt: now(), exitCode: 143, error: "Cancelled by user",
      });
      return { ok: false, runId, error: "mission was cancelled before submission" };
    }
    submissionAttempted = true;
    const handle = await runtime.submitRun({
      input: mission.prompt,
      idempotencyKey: runId,
      profileName: mission.profileName ?? undefined,
      sessionId: session.id,
    });
    backendRunId = handle.runId;
    const resolvedSession = handle.sessionId ?? session.id;
    const accepted = acknowledgeMissionSubmission(runId, missionId, {
      runId: handle.runId,
      sessionId: resolvedSession,
      status: handle.status,
    });
    if (!accepted) {
      await runtime.stopRun(handle.runId, mission.profileName ?? undefined).catch((error: unknown) => {
        logApiError("orchestration.dispatchMissionRun", `${missionId} late stop`, error);
      });
      return { ok: false, runId, error: "mission was cancelled before acknowledgement" };
    }
    recordEvent("mission.dispatched", {
      entityType: "mission",
      entityId: missionId,
      profile: mission.profileName ?? null,
    });
    recordEvent("session.started", {
      entityType: "session",
      entityId: resolvedSession,
      profile: mission.profileName ?? null,
    });
    return { ok: true, runId, backendRunId: handle.runId, sessionId: resolvedSession };
  } catch (err) {
    const message = messageFromError(err, "dispatch failed");
    logApiError("orchestration.dispatchMissionRun", missionId, err);
    if (backendRunId) {
      await runtime.stopRun(backendRunId, mission.profileName ?? undefined).catch((error: unknown) => {
        logApiError("orchestration.dispatchMissionRun", `${missionId} failed stop`, error);
      });
    }
    // A network failure or failed acknowledgement does not prove the gateway
    // rejected the request. Keep the durable claim for operator review.
    if (submissionAttempted) {
      markMissionSubmissionUnconfirmedIfActive(runId, missionId, UNCONFIRMED_SUBMISSION_RESULT);
      return { ok: false, runId, error: UNCONFIRMED_SUBMISSION_RESULT };
    }
    if (failMissionSubmissionIfActive(runId, missionId, message)) {
      closeSessionForMission(missionId, {
        status: "failed",
        endedAt: now(),
        exitCode: 1,
        error: message,
      });
    }
    return { ok: false, runId, error: message };
  }
}

/**
 * Ask the backend to stop a mission's run. The REMOTE half of a cancellation
 * only — it writes nothing locally.
 *
 * The local half is `finaliseCancelledMission`, and the one place that puts the
 * two together is the action handler in mission-handlers/cancel.ts: record
 * first, synchronously, then this in the background. There used to be a second
 * composition here (`cancelMissionRun`: stop first, then record) behind the
 * REST route; the same click took a different order and answered a different
 * envelope depending on the door (T-0070, T-0095 D128). The REST route now
 * delegates to the handler, and this file keeps only the remote half.
 */
export async function stopBackendRunForMission(missionId: string): Promise<void> {
  for (const run of listCancelledBackendRunsForMission(missionId)) {
    try {
      await runtime.stopRun(run.runId!, run.profileName ?? undefined);
    } catch (err) {
      logApiError("orchestration.stopBackendRunForMission", `${missionId} ${run.id}`, err);
      // best-effort: the local record is the operator's answer either way
    }
  }
}
