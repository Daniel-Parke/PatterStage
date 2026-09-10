// ═══════════════════════════════════════════════════════════════
// orchestration/scheduler/health.ts: is the scheduler alive?
//
// The BackgroundScheduler writes two `meta` rows on every tick, the lease owner
// and its last refresh, and nothing in the console read them, so a dead
// scheduler looked exactly like a quiet one. This is the read side of those
// rows: same keys, same staleness rule the lease uses, no new tracking. The
// keys and window live HERE rather than in BackgroundScheduler so an API route
// wanting two strings does not import the sync layer, the composer engine and
// the runtime adapter.
// ═══════════════════════════════════════════════════════════════

import { getMetaPair } from "@/lib/system/system-repository";

/** `meta` key: pid of the process that holds the scheduling lease. */
export const META_OWNER_PID = "scheduler_owner_pid";

/** `meta` key: ISO instant of that process's last heartbeat. */
export const META_HEARTBEAT = "scheduler_heartbeat_at";

/**
 * Older than this and the owner is presumed dead. The loop ticks every 15s, so
 * a minute is four missed ticks: late enough not to flap, early enough to be news.
 */
export const HEARTBEAT_STALE_MS = 60_000;

export interface SchedulerHealth {
  /** Pid holding the lease, or null when no lease has ever been written. */
  ownerPid: number | null;
  /** ISO instant of the last heartbeat, or null when there has never been one. */
  lastTickAt: string | null;
  /** True when nothing has ticked inside the stale window. */
  stale: boolean;
  /** The stale window, so a surface can say what "stale" means without hardcoding it. */
  staleAfterMs: number;
  /**
   * The pid that produced this reading. `ownerPid` alone cannot answer "will
   * THIS process fire a schedule", so a follower rendered what the owner
   * rendered and an operator running two instances was told all was fine while
   * dispatches happened elsewhere (T-0064). Nullable so a caller that cannot
   * supply it keeps the old reading.
   */
  selfPid: number | null;
}

/**
 * Read the lease and heartbeat. Never throws: the read degrades to "we cannot
 * tell" rather than take down the surface that asked. An absent heartbeat
 * reads as stale, because never ticked and stopped ticking are the same news.
 */
export function readSchedulerHealth(now: number = Date.now()): SchedulerHealth {
  const selfPid = typeof process !== "undefined" ? process.pid : null;
  let ownerPid: number | null = null;
  let lastTickAt: string | null = null;
  try {
    for (const row of getMetaPair(META_OWNER_PID, META_HEARTBEAT)) {
      if (row.key === META_OWNER_PID) {
        const pid = Number(row.value);
        ownerPid = Number.isFinite(pid) ? pid : null;
      } else if (row.key === META_HEARTBEAT) {
        lastTickAt = row.value;
      }
    }
  } catch {
    // No lease info; reported as stale below.
  }

  const beat = lastTickAt ? Date.parse(lastTickAt) : NaN;
  const stale = !Number.isFinite(beat) || now - beat >= HEARTBEAT_STALE_MS;

  return { ownerPid, lastTickAt, stale, staleAfterMs: HEARTBEAT_STALE_MS, selfPid };
}
