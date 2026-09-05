// ═══════════════════════════════════════════════════════════════
// orchestration/dispatch.ts — turn a mission into a running agent run
//
// Replaces the old two-phase bash dispatch (mission-dispatch.ts +
// backends/hermes.ts). A mission becomes an HTTP run via runtime.submitRun():
// no bash wrapper, no pid/status files, no stdout parsing for the session id.
// The run row + a pre-registered session row track lifecycle; RunSync
// reconciles them by polling the runtime.
// ═══════════════════════════════════════════════════════════════

import { getMission, updateMission } from "@/lib/missions/mission-repository";
import {
  createRun,
  attachBackendRun,
  updateRun,
  getLatestRunForMission,
} from "@/lib/runs-repository";
import { createSession, closeSessionForMission } from "@/lib/sessions/session-repository";
import { runtime } from "@/lib/runtime";
import { uuid, now } from "@/lib/db";
import { messageFromError } from "@/lib/api-fetch";
import { logApiError } from "@/lib/api-logger";
import { recordEvent } from "@/lib/analytics/record-event";

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

  const runId = opts.runId ?? uuid();
  // Idempotent: the scheduler may have already inserted this run row.
  createRun({
    id: runId,
    missionId,
    scheduleId: opts.scheduleId ?? null,
    profileName: mission.profileName ?? null,
  });

  // Pre-register an active session row so the dashboard shows the live run.
  const session = createSession({
    source: "mission",
    missionId,
    profileName: mission.profileName ?? null,
    modelId: mission.modelId ?? null,
    provider: mission.provider ?? null,
    title: mission.name,
  });

  try {
    const handle = await runtime.submitRun({
      input: mission.prompt,
      idempotencyKey: runId,
      profileName: mission.profileName ?? undefined,
      sessionId: session.id,
    });
    const resolvedSession = handle.sessionId ?? session.id;
    attachBackendRun(runId, {
      runId: handle.runId,
      sessionId: resolvedSession,
      status: handle.status,
    });
    // Clear any prior run's result so a re-dispatched mission doesn't display
    // stale output (e.g. an old LLM monologue) while the new run is in flight —
    // the reconcile path writes the fresh result on completion. (QA #9/#43)
    updateMission(missionId, { status: "dispatched", sessionId: resolvedSession, result: null });
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
    updateRun(runId, { status: "failed", error: message });
    updateMission(missionId, { status: "failed", result: message });
    closeSessionForMission(missionId, {
      status: "failed",
      endedAt: now(),
      exitCode: 1,
      error: message,
    });
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
  const run = getLatestRunForMission(missionId);
  if (!run?.runId) return;
  try {
    await runtime.stopRun(run.runId, run.profileName ?? undefined);
  } catch (err) {
    logApiError("orchestration.stopBackendRunForMission", missionId, err);
    // best-effort: the local record is the operator's answer either way
  }
}
