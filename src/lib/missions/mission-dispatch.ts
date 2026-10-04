// ═══════════════════════════════════════════════════════════════
// mission-dispatch.ts — shared immediate mission dispatch (API + queue sync)
//
// Apply mission overrides before dispatch and keep the shared
// { ok, sessionId } result used by immediate and queued callers.
// ═══════════════════════════════════════════════════════════════

import { getMission, updateMission } from "@/lib/missions/mission-repository";
import { dispatchMissionRun } from "@/lib/orchestration";

export interface DispatchMissionNowOverrides {
  /** Pre-claimed unattended run ID; also the gateway idempotency key. */
  runId?: string;
  profileName?: string;
  modelId?: string;
  provider?: string;
  /** Link the run to a schedule (the recurring-mission first run). */
  scheduleId?: string;
}

export interface DispatchMissionNowResult {
  ok: boolean;
  sessionId?: string;
}

/**
 * Dispatch a mission immediately via the agent runtime. Any caller overrides
 * (profile/model/provider) are applied to the mission record first so the
 * runtime resolves the correct profile endpoint.
 */
export async function dispatchMissionNow(
  missionId: string,
  overrides: DispatchMissionNowOverrides = {},
): Promise<DispatchMissionNowResult> {
  const mission = getMission(missionId);
  if (!mission) return { ok: false };
  if (overrides.runId && mission.status !== "dispatched") return { ok: false };

  if (
    overrides.profileName !== undefined ||
    overrides.modelId !== undefined ||
    overrides.provider !== undefined
  ) {
    updateMission(missionId, {
      profileName: overrides.profileName,
      modelId: overrides.modelId,
      provider: overrides.provider,
    });
  }

  const result = await dispatchMissionRun(missionId, {
    runId: overrides.runId,
    scheduleId: overrides.scheduleId,
  });
  return { ok: result.ok, sessionId: result.sessionId };
}
