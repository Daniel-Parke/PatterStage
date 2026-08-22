// ═══════════════════════════════════════════════════════════════
// mission-queue-tick.ts — run one MissionQueueSync cycle (API + scheduler)
// ═══════════════════════════════════════════════════════════════

import {
  getNextQueuedMission,
  hasDispatchedMission,
} from "@/lib/missions/mission-repository";
import { dispatchMissionNow } from "@/lib/missions/mission-dispatch";

export interface MissionQueueTickResult {
  ran: boolean;
  missionId?: string;
  ok?: boolean;
}

/**
 * Dispatch the oldest queued-for-run mission when no mission is currently dispatched.
 */
export async function runMissionQueueTick(): Promise<MissionQueueTickResult> {
  if (hasDispatchedMission()) {
    return { ran: false };
  }

  const next = getNextQueuedMission();
  if (!next) {
    return { ran: false };
  }

  const result = await dispatchMissionNow(next.id);
  return { ran: true, missionId: next.id, ok: result.ok };
}
