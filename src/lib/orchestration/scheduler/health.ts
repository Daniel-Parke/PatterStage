// ═══════════════════════════════════════════════════════════════
// orchestration/scheduler/health.ts: is the scheduler alive?
//
// The BackgroundScheduler already writes two rows to `meta` on every
// tick: which process holds the scheduling lease, and when it last
// refreshed it. That is a heartbeat, and until now the only way to read
// it was to open the database by hand or to watch a server console the
// operator does not have. So a dead scheduler looked exactly like a
// quiet one: schedules silently stopped firing, and dispatched runs
// stopped being reconciled, with nothing anywhere in the console to say
// so.
//
// This module is the read side of those two rows. It invents no new
// tracking: same keys, same staleness rule the lease itself uses, one
// query through the `meta` repository.
//
// The keys and the stale window live HERE rather than in
// BackgroundScheduler so the reader does not have to import the writer.
// Importing BackgroundScheduler from an API route would drag the whole
// sync layer, the composer engine and the runtime adapter into a request
// that wants two strings.
// ═══════════════════════════════════════════════════════════════

import { getMetaPair } from "@/lib/system-repository";

/** `meta` key: pid of the process that holds the scheduling lease. */
export const META_OWNER_PID = "scheduler_owner_pid";

/** `meta` key: ISO instant of that process's last heartbeat. */
export const META_HEARTBEAT = "scheduler_heartbeat_at";

/**
 * A heartbeat older than this means the owner is presumed dead and the
 * lease is up for grabs. The loop ticks every 15s, so a minute is four
 * missed ticks: late enough not to flap, early enough to be news.
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
   * The pid of the process that produced this reading.
   *
   * `ownerPid` alone cannot answer "will THIS process fire a schedule", because
   * the client has no way to know which process served the request. Without
   * both, a follower renders exactly what the owner renders and an operator
   * running two instances is told everything is fine while their dispatches
   * happen somewhere they are not looking (T-0064).
   *
   * Nullable so a caller that cannot supply it keeps the old reading.
   */
  selfPid: number | null;
}

/**
 * Read the scheduler's lease + heartbeat.
 *
 * Never throws: a scheduler-health read that fails must degrade to "we
 * cannot tell", never take down the surface that asked. An absent
 * heartbeat reads as stale, because "the scheduler has never ticked" and
 * "the scheduler stopped ticking" are the same news to an operator
 * waiting on a schedule.
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
    // No lease info. Reported as stale below, which is the honest answer.
  }

  const beat = lastTickAt ? Date.parse(lastTickAt) : NaN;
  const stale = !Number.isFinite(beat) || now - beat >= HEARTBEAT_STALE_MS;

  return { ownerPid, lastTickAt, stale, staleAfterMs: HEARTBEAT_STALE_MS, selfPid };
}
