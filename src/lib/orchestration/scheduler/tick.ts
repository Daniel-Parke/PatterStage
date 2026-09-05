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
import { hasDispatchedMission } from "@/lib/missions/mission-repository";
import { computeNextRun } from "@/lib/schedule/next-run";
import { dispatchMissionRun } from "@/lib/orchestration/dispatch";
import { runScriptFile } from "@/lib/scripts-manager";
import { logApiError } from "@/lib/api-logger";
import { recordEvent } from "@/lib/analytics/record-event";
import { checkUnattendedSpend } from "@/lib/spend/spend-guard";

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
/**
 * Run the host script a schedule row names.
 *
 * Deliberately NOT the mission path with a different verb at the end. A script
 * run is not an agent run: it claims no `runs` row (those carry a mission), and
 * it is not held behind the one-mission-at-a-time single flight, which is about
 * the agent rather than about the host. What it does share is the catch-up
 * policy and the advance, because those are statements about the schedule.
 */
async function fireScriptSchedule(sched: ScheduleRecord, nowDate: Date): Promise<boolean> {
  // The same shape as the orphaned-mission branch: a row that names nothing
  // can never fire, so it says so once and stops being selected.
  if (!sched.scriptName) {
    advanceSchedule(sched.id, {
      nextRunAt: null,
      lastRunAt: nowDate.toISOString(),
      lastRunId: null,
      lastStatus: "skipped: no script named",
      enabled: false,
    });
    return false;
  }

  const dueAt = sched.nextRunAt ? new Date(sched.nextRunAt) : nowDate;
  if (sched.catchUpPolicy === "skip" && nowDate.getTime() - dueAt.getTime() > CATCH_UP_GRACE_MS) {
    advanceToNext(sched, nowDate, null, "skipped (catch-up)", false);
    return false;
  }

  const result = await runScriptFile(sched.scriptName);
  advanceToNext(
    sched,
    nowDate,
    null,
    result.ok ? "ran" : `error: ${result.error ?? "script exited non-zero"}`,
    true,
  );
  // After the advance, never before it: no event claims a run the row does not
  // record.
  if (result.ok) {
    recordEvent("script.run", {
      entityType: "script",
      entityId: sched.scriptName,
      metadata: { source: "scheduler" },
    });
  }
  return result.ok;
}

async function fireSchedule(sched: ScheduleRecord, nowDate: Date): Promise<boolean> {
  // BEFORE the orphan check, and that order is the whole point. A script row
  // has no mission, so the branch below would disable every row migration 041
  // creates on the first tick that saw it, and the feature would be dead on
  // arrival while looking perfectly wired (T-0107, decision 10).
  if (sched.kind === "script") return fireScriptSchedule(sched, nowDate);

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

export interface SchedulerTickResult {
  fired: number;
  /**
   * Set when the operator's hard spend stop refused this tick. Present only
   * when something was actually refused, so the ordinary result is unchanged.
   */
  blocked?: string;
}

/** Run one scheduler tick. Returns how many schedules dispatched a run. */
export async function runSchedulerTick(
  opts: SchedulerTickOptions = {},
): Promise<SchedulerTickResult> {
  if (opts.isOwner === false) return { fired: 0 };

  // The operator's hard spend stop, when he has set a figure AND armed one
  // (T-0021, WO-0014). This is UNATTENDED dispatch, which is what his rule is
  // about; a human clicking dispatch never reaches this file.
  //
  // The check happens BEFORE getDueSchedules, so a blocked tick does not
  // advance next_run_at and does not consume the occurrence. That makes the
  // stop a pause: the schedule fires on the first tick after the period rolls
  // over or the figure is raised, rather than having silently skipped a run.
  const gate = checkUnattendedSpend();
  if (!gate.allowed) return { fired: 0, blocked: gate.reason ?? "spend stop" };

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
    const { fired, blocked } = await runSchedulerTick({ isOwner: this.isOwner() });
    // A spend stop is a deliberate refusal, not a failure, so success stays
    // true. The reason rides along so the monitor surface can say why nothing
    // is firing instead of looking like a wedged scheduler.
    return {
      sourceName: this.name,
      success: true,
      syncedCount: fired,
      error: blocked,
      durationMs: 0,
    };
  }
}
