// ═══════════════════════════════════════════════════════════════
// orchestration/scheduler/tick.ts — the PatterStage-owned scheduler tick
//
// Replaces the Hermes jobs.json scheduler entirely. Each tick: select due
// schedules (next_run_at <= now), claim each occurrence with a DETERMINISTIC
// run id (so a duplicate tick across processes can't double-dispatch — the PK
// guard rejects the second), dispatch via the runtime, then advance
// next_run_at to the next future occurrence. Restart-safe: due work is
// recomputed from next_run_at, never an in-memory timer.
// ═══════════════════════════════════════════════════════════════

import type { SyncSource, SyncResult } from "@/lib/sync/types";
import {
  getDueSchedules,
  advanceSchedule,
  type ScheduleRecord,
} from "@/lib/schedules-repository";
import { createRun } from "@/lib/runs-repository";
import { hasDispatchedMission } from "@/lib/mission-repository";
import { computeNextRun } from "@/lib/schedule/next-run";
import { dispatchMissionRun } from "@/lib/orchestration/dispatch";
import { logApiError } from "@/lib/api-logger";
import { recordEvent } from "@/lib/analytics/record-event";

/** Occurrences more than this late are treated as catch-up (post-downtime). */
const CATCH_UP_GRACE_MS = 120_000;

function occurrenceId(sched: ScheduleRecord, nowIso: string): string {
  return `sch_${sched.id}_${sched.nextRunAt ?? nowIso}`;
}

/** Advance a schedule to its next future occurrence (or disable when exhausted). */
function advanceToNext(
  sched: ScheduleRecord,
  nowDate: Date,
  lastRunId: string | null,
  lastStatus: string,
  fired: boolean,
): void {
  const nextDone = sched.repeatDone + (fired ? 1 : 0);
  const exhausted = sched.repeatTimes != null && nextDone >= sched.repeatTimes;
  const next = exhausted ? null : computeNextRun(sched.schedule, nowDate);
  const nextRunAt = next ? next.toISOString() : null;

  advanceSchedule(sched.id, {
    nextRunAt,
    lastRunAt: nowDate.toISOString(),
    lastRunId,
    lastStatus,
    incrementDone: fired,
    // Disable when a finite schedule is exhausted or there is no next run.
    enabled: exhausted || nextRunAt === null ? false : undefined,
  });
}

/** Fire (or skip) one due schedule. Returns true if a run was dispatched. */
async function fireSchedule(sched: ScheduleRecord, nowDate: Date): Promise<boolean> {
  // Orphaned schedule (mission deleted) — disable so it stops being selected.
  if (!sched.missionId) {
    advanceSchedule(sched.id, {
      nextRunAt: null,
      lastRunAt: nowDate.toISOString(),
      lastRunId: null,
      lastStatus: "skipped: no linked mission",
      enabled: false,
    });
    return false;
  }

  // Catch-up policy: collapse missed occurrences. "skip" advances without
  // firing; "fire_once" (default) fires exactly once now.
  const dueAt = sched.nextRunAt ? new Date(sched.nextRunAt) : nowDate;
  const lateMs = nowDate.getTime() - dueAt.getTime();
  if (sched.catchUpPolicy === "skip" && lateMs > CATCH_UP_GRACE_MS) {
    advanceToNext(sched, nowDate, null, "skipped (catch-up)", false);
    return false;
  }

  // Single-flight: respect "one mission running at a time". Leave next_run_at
  // in the past so the occurrence retries on a later tick.
  if (hasDispatchedMission()) {
    return false;
  }

  // Exactly-once claim: a deterministic id means a duplicate tick (e.g. two
  // processes overlapping at restart) collides on the PK and the second is a
  // no-op. Idempotency-Key = this id also protects the backend submit.
  const runId = occurrenceId(sched, nowDate.toISOString());
  const claimed = createRun({
    id: runId,
    missionId: sched.missionId,
    scheduleId: sched.id,
    profileName: sched.profileName,
  });
  if (!claimed) {
    // Another tick already claimed this occurrence — just advance.
    advanceToNext(sched, nowDate, runId, "duplicate occurrence", false);
    return false;
  }

  const result = await dispatchMissionRun(sched.missionId, {
    runId,
    scheduleId: sched.id,
  });
  advanceToNext(
    sched,
    nowDate,
    result.backendRunId ?? runId,
    result.ok ? "dispatched" : `error: ${result.error ?? "unknown"}`,
    true,
  );
  if (result.ok) {
    recordEvent("schedule.fired", {
      entityType: "schedule",
      entityId: sched.id,
      profile: sched.profileName,
    });
  }
  return result.ok;
}

export interface SchedulerTickOptions {
  now?: Date;
  /** When false, this process is a follower and must not dispatch. */
  isOwner?: boolean;
}

/** Run one scheduler tick. Returns how many schedules dispatched a run. */
export async function runSchedulerTick(
  opts: SchedulerTickOptions = {},
): Promise<{ fired: number }> {
  if (opts.isOwner === false) return { fired: 0 };

  const nowDate = opts.now ?? new Date();
  const due = getDueSchedules(nowDate.toISOString());
  let fired = 0;
  for (const sched of due) {
    try {
      if (await fireSchedule(sched, nowDate)) fired += 1;
    } catch (err) {
      logApiError("scheduler.fireSchedule", sched.id, err);
    }
  }
  return { fired };
}

/** SyncSource wrapper so the BackgroundScheduler runs the tick on its loop. */
export class ScheduleTickSource implements SyncSource {
  readonly name = "scheduler";
  constructor(private readonly isOwner: () => boolean) {}

  async sync(): Promise<SyncResult> {
    const { fired } = await runSchedulerTick({ isOwner: this.isOwner() });
    return { sourceName: this.name, success: true, syncedCount: fired, durationMs: 0 };
  }
}
