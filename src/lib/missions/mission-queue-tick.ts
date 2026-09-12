// ═══════════════════════════════════════════════════════════════
// mission-queue-tick.ts — run one MissionQueueSync cycle (API + scheduler)
// ═══════════════════════════════════════════════════════════════

import {
  getNextQueuedMission,
  hasDispatchedMission,
} from "@/lib/missions/mission-repository";
import { dispatchMissionNow } from "@/lib/missions/mission-dispatch";
import { checkUnattendedSpend } from "@/lib/spend/spend-guard";

export interface MissionQueueTickResult {
  ran: boolean;
  missionId?: string;
  ok?: boolean;
  /**
   * Set when the operator's hard spend stop refused this tick. Present only
   * when something was actually refused.
   */
  blocked?: string;
}

/**
 * Dispatch the oldest queued-for-run mission when no mission is currently dispatched.
 */
export async function runMissionQueueTick(): Promise<MissionQueueTickResult> {
  // The operator's hard spend stop, when he has set a figure AND armed one
  // (T-0021, WO-0014). Draining the queue is unattended dispatch: nobody is
  // watching the moment it fires. Checked first, so a blocked tick leaves the
  // mission exactly where it is, still queued, still dispatchable by hand.
  const gate = checkUnattendedSpend();
  if (!gate.allowed) return { ran: false, blocked: gate.reason ?? "spend stop" };

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
