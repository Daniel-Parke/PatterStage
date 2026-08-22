// ═══════════════════════════════════════════════════════════════
// mission-dispatch.ts — shared immediate mission dispatch (API + queue sync)
//
// This is now a thin compatibility shim over the orchestration core: the old
// two-phase bash dispatch (agentBackend.dispatchMission + spawnDispatchedMission
// + pid/status files + pollForSessionId) is gone. Every caller (the missions
// god-route, the cron first-run, the queue tick) routes through the runtime
// (HTTP run) via dispatchMissionRun(). Kept as a seam so existing call sites
// don't need to change until the Phase 7 god-route split.
// ═══════════════════════════════════════════════════════════════

import { getMission, updateMission } from "@/lib/missions/mission-repository";
import { dispatchMissionRun } from "@/lib/orchestration";

export interface DispatchMissionNowOverrides {
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

  const result = await dispatchMissionRun(missionId, { scheduleId: overrides.scheduleId });
  return { ok: result.ok, sessionId: result.sessionId };
}
