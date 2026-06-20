// ═══════════════════════════════════════════════════════════════
// orchestration/dispatch.ts — turn a mission into a running agent run
//
// Replaces the old two-phase bash dispatch (mission-dispatch.ts +
// backends/hermes.ts). A mission becomes an HTTP run via runtime.submitRun():
// no bash wrapper, no pid/status files, no stdout parsing for the session id.
// The run row + a pre-registered session row track lifecycle; RunSync
// reconciles them by polling the runtime.
// ═══════════════════════════════════════════════════════════════

import { getMission, updateMission } from "@/lib/mission-repository";
import {
  createRun,
  attachBackendRun,
  updateRun,
  getLatestRunForMission,
} from "@/lib/runs-repository";
import { createSession, closeSessionForMission } from "@/lib/session-repository";
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
    updateMission(missionId, { status: "dispatched", sessionId: resolvedSession });
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
 * Cancel a mission's current run. Stops the backend run over HTTP (no signals /
 * pkill), then marks the run, mission, and session terminal. Best-effort on the
 * backend stop — local state is always finalised so the UI never shows a stuck
 * "running" row.
 */
export async function cancelMissionRun(
  missionId: string,
): Promise<{ ok: boolean; error?: string }> {
  const mission = getMission(missionId);
  if (!mission) return { ok: false, error: "mission not found" };

  const run = getLatestRunForMission(missionId);
  if (run?.runId) {
    try {
      await runtime.stopRun(run.runId, run.profileName ?? undefined);
    } catch (err) {
      logApiError("orchestration.cancelMissionRun", missionId, err);
      // best-effort — still finalise local state below
    }
  }
  if (run && run.status === "started") {
    updateRun(run.id, { status: "cancelled", error: "Cancelled by user" });
  }
  updateMission(missionId, { status: "failed", result: "Cancelled by user" });
  closeSessionForMission(missionId, {
    status: "failed",
    endedAt: now(),
    exitCode: 143,
    error: "Cancelled by user",
  });
  return { ok: true };
}
