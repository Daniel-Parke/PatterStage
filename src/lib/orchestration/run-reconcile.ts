// ═══════════════════════════════════════════════════════════════
// orchestration/run-reconcile.ts — reconcile runs by polling the runtime
//
// Replaces MissionSync's status.json polling / pid-liveness probes / orphan
// sweeps. The backend (Hermes) is the authority for a run's state: a run id
// resolves to a status or 404s. We poll non-terminal runs, write terminal
// state to the run + mission + session rows, and recover orphans on boot.
//
// Polling is the source of truth; SSE (runtime.streamRunEvents) is UX-only.
// ═══════════════════════════════════════════════════════════════

import {
  getRun as getLocalRun,
  listActiveRuns,
  updateRun,
  type RunRecord,
} from "@/lib/runs-repository";
import { updateMission, getMission } from "@/lib/missions/mission-repository";
import { closeSessionForMission } from "@/lib/sessions/session-repository";
import { runtime } from "@/lib/runtime";
import { now } from "@/lib/db";
import { RuntimeRequestError, type RunStatus, type RunUsage } from "@/lib/runtime/types";
import { recordEvent } from "@/lib/analytics/record-event";
import { finalizeComposerNodeRun, advanceComposerRun } from "@/lib/composer/engine";
import { captureArtifactOnce } from "@/lib/artifacts-repository";
import { logApiError } from "@/lib/api-logger";
import {
  DEFAULT_MAX_RUN_MINUTES,
  GRACE_MINUTES,
  declaredTimeoutMinutes,
  parseRunTimestamp,
} from "@/lib/orchestration/run-deadline";

/** Map a terminal run status onto the mission status enum (no 'cancelled'). */
function missionStatusFor(runStatus: RunStatus): "successful" | "failed" {
  return runStatus === "completed" ? "successful" : "failed";
}

// ── Stuck-run deadlines (self-healing single-flight) ──────────────
// A run stuck in 'started' keeps its mission 'dispatched', which blocks the
// single-flight gate (hasDispatchedMission) and therefore the scheduler + queue.
// To self-heal we fail runs that are clearly stuck:
//   • backend UNREACHABLE past the deadline (the gateway-down case) → fail;
//   • backend still reports 'started' past a DECLARED timeout → fail (enforce it).
// An untimed mission the backend still reports running is left alone (the user
// chose no timeout; it isn't "stuck", just long).
//
// The two constants and the timestamp parse moved to run-deadline.ts so the
// mission API can publish the same instant to the console. The rule they encode
// is unchanged; it is now readable by the surface that has to explain it.

function ageMinutes(run: RunRecord): number {
  const start = parseRunTimestamp(run.submittedAt);
  return Number.isFinite(start) ? (Date.now() - start) / 60_000 : 0;
}

/** The mission's declared max runtime in minutes, if any (timeout wins). */
function missionDeadlineMinutes(missionId: string | null): number | null {
  if (!missionId) return null;
  return declaredTimeoutMinutes(getMission(missionId));
}

/**
 * Apply a terminal run state to the linked mission + session. Idempotent:
 * safe if the mission/session were already closed.
 */
function finalizeMissionForRun(
  missionId: string | null,
  runStatus: RunStatus,
  resultText: string | null,
): void {
  if (!missionId) return;
  const missionStatus = missionStatusFor(runStatus);
  updateMission(missionId, {
    status: missionStatus,
    result: resultText ?? undefined,
  });
  closeSessionForMission(missionId, {
    status: missionStatus === "successful" ? "completed" : "failed",
    endedAt: now(),
    exitCode: missionStatus === "successful" ? 0 : 1,
    error: missionStatus === "failed" ? (resultText ?? "run failed") : null,
  });
}

/**
 * Finalize a run terminally AND record the analytics event. Used only by the
 * live reconcile path (a real terminal transition), NOT by reconcileRunsOnBoot
 * — boot recovery re-fails interrupted runs and must not double-count events.
 */
function finalizeAndRecord(run: RunRecord, runStatus: RunStatus, resultText: string | null): void {
  finalizeMissionForRun(run.missionId, runStatus, resultText);
  // Capture a completed mission's output as an artifact (idempotent, best-effort).
  if (runStatus === "completed" && run.missionId && resultText && resultText.trim().length > 0) {
    try {
      const mission = getMission(run.missionId);
      captureArtifactOnce({
        sourceKind: "mission",
        sourceRunId: run.id,
        name: mission?.name ?? "Mission output",
        description: "Mission run output",
        mimeType: "text/markdown",
        content: resultText,
        tags: ["mission"],
      });
    } catch (err) {
      logApiError("mission.captureArtifact", run.id, err);
    }
  }
  recordEvent(runStatus === "completed" ? "mission.completed" : "mission.failed", {
    entityType: "mission",
    entityId: run.missionId ?? undefined,
    profile: run.profileName ?? null,
  });
  recordEvent("session.closed", {
    entityType: "session",
    entityId: run.sessionId ?? run.missionId ?? undefined,
    profile: run.profileName ?? null,
  });
}

/** Finalize a terminal Composer stage-run + advance its workflow graph. */
async function finalizeComposerStage(
  run: RunRecord,
  status: RunStatus,
  output: string | null,
  error: string | null,
  usage: RunUsage | null = null,
): Promise<void> {
  // `usage` is written for the same reason the agent branch writes it below:
  // spend-repository selects `WHERE usage_json IS NOT NULL`, so a stage that
  // does not record its tokens is not priced conservatively, it is priced at
  // nothing. It defaults to null rather than being omitted because the three
  // callers that finalize a stage WITHOUT reaching the gateway genuinely have
  // no tokens to report, and null says that where a missing argument would
  // only mean "leave unchanged".
  updateRun(run.id, { status, output, error, usage });
  const composerRunId = finalizeComposerNodeRun(run.id, status, output, error);
  if (composerRunId) await advanceComposerRun(composerRunId);
}

/** Reconcile a run that executes a Composer stage (branch of reconcileOne). */
async function reconcileComposerRun(run: RunRecord): Promise<boolean> {
  if (!run.runId) {
    await finalizeComposerStage(run, "failed", null, "stage was never submitted to the backend");
    return true;
  }
  const age = ageMinutes(run);
  const cap = DEFAULT_MAX_RUN_MINUTES + GRACE_MINUTES;
  try {
    const result = await runtime.getRun(run.runId, run.profileName ?? undefined);
    // It answered, so it is not missing. A gateway restarting mid-poll can 404
    // once and reply normally moments later; that run was never lost, and any
    // future disappearance must start its window from zero (T-0078).
    clearNotFound(run.id);
    if (result.status === "started") {
      if (age > cap) {
        await runtime.stopRun(run.runId, run.profileName ?? undefined).catch(() => {});
        await finalizeComposerStage(run, "failed", null, "stage exceeded the max runtime");
        return true;
      }
      return false;
    }
    await finalizeComposerStage(
      run,
      result.status,
      result.output ?? null,
      result.error ?? null,
      result.usage ?? null,
    );
    return true;
  } catch (err) {
    if (err instanceof RuntimeRequestError && err.status === 404) {
      // Same shape as the mission branch: inside the grace, fall through to the
      // stage deadline rather than returning early.
      if (notFoundPersisted(run.id)) {
        await finalizeComposerStage(run, "failed", null, "backend no longer has this stage run (404)");
        return true;
      }
    }
    if (age > cap) {
      await finalizeComposerStage(run, "failed", null, "backend unreachable past the stage deadline");
      return true;
    }
    return false; // transient — retry next tick
  }
}

/**
 * How long a 404 must PERSIST before it is accepted as the backend's final
 * answer about a run.
 *
 * Hermes keeps its run registry in memory, so a restart answers 404 for every
 * live run. Treating the first 404 as terminal — which is what this did — fails
 * every in-flight mission and Composer stage within one tick of an upgrade or a
 * crash (T-0078). Roughly eight scheduler ticks: long enough that a bounce
 * heals itself, short enough that a genuinely lost run does not hold the
 * single-flight gate for the 125-minute deadline.
 */
export const RUN_NOT_FOUND_GRACE_MS = 2 * 60_000;

/**
 * When each run was FIRST seen missing. Process-local on purpose.
 *
 * A counter would not do: POST /api/runs/reconcile is public and the smokes
 * poll it every second, so "N consecutive 404s" can elapse in N seconds and
 * measures how often somebody asked rather than how long the run has been gone.
 * Elapsed time is the only honest evidence here.
 *
 * Losing this map on restart costs one fresh window — a new process making a
 * new observation, which is arguably the more correct behaviour — and the
 * deadline cap remains the backstop either way. A column would publish a
 * process-local judgement as durable operator-facing truth, and nothing renders
 * it.
 */
const firstNotFoundAt = new Map<string, number>();

/**
 * Is this run still ours to finalize?
 *
 * reconcile snapshots listActiveRuns and THEN awaits the gateway per row, so a
 * cancellation landing during that await would otherwise be overwritten by a
 * verdict computed before it happened -- resurrecting a run the operator
 * stopped, and re-opening the mission behind it. T-0076 closed the same race on
 * the Composer side; this is the mission half, which predates it (T-0078).
 */
function stillActive(runPk: string): boolean {
  const fresh = getLocalRun(runPk);
  // A row that has VANISHED is not ours either: deleting a mission cascades to
  // its runs, so this is reachable when a delete lands during the await. There
  // is nothing left to finalize, and writing mission state for a run that no
  // longer exists would be inventing history.
  if (!fresh) return false;
  return fresh.status === "started";
}

/** Has this run been answering 404 for longer than the grace? Records if new. */
function notFoundPersisted(runPk: string): boolean {
  const first = firstNotFoundAt.get(runPk);
  if (first === undefined) {
    firstNotFoundAt.set(runPk, Date.now());
    return false;
  }
  return Date.now() - first >= RUN_NOT_FOUND_GRACE_MS;
}

/** A run answered, or ended — it is not missing any more. */
function clearNotFound(runPk: string): void {
  firstNotFoundAt.delete(runPk);
}

/** Test seam: the tracker outlives a jest `beforeEach`, so tests reset it. */
export function resetNotFoundTracker(): void {
  firstNotFoundAt.clear();
}

/** Poll one active run and write any terminal transition. Returns true if it advanced. */
async function reconcileOne(run: RunRecord): Promise<boolean> {
  // Composer stage-runs advance a workflow graph, not a mission.
  if (run.composerNodeRunId) return reconcileComposerRun(run);

  // Never got a backend id — submit failed/crashed mid-flight.
  if (!run.runId) {
    updateRun(run.id, { status: "failed", error: "run was never submitted to the backend" });
    finalizeAndRecord(run, "failed", "run was never submitted to the backend");
    return true;
  }

  const age = ageMinutes(run);
  const declared = missionDeadlineMinutes(run.missionId);

  try {
    const result = await runtime.getRun(run.runId, run.profileName ?? undefined);
    // It answered, so it is not missing. A gateway restarting mid-poll can 404
    // once and reply normally moments later; that run was never lost, and any
    // future disappearance must start its window from zero (T-0078).
    clearNotFound(run.id);
    if (result.status === "started") {
      // Enforce a DECLARED timeout even if the backend still reports running, so
      // a runaway mission can't hold the single-flight gate forever.
      if (declared !== null && age > declared + GRACE_MINUTES) {
        await runtime.stopRun(run.runId, run.profileName ?? undefined).catch(() => {});
        const msg = `run exceeded its ${declared}m timeout`;
        updateRun(run.id, { status: "failed", error: msg });
        finalizeAndRecord(run, "failed", msg);
        return true;
      }
      return false; // still running, within its window
    }

    // Someone may have cancelled this run while we were awaiting the gateway.
    // Their decision is newer than this verdict and wins.
    if (!stillActive(run.id)) return true;

    updateRun(run.id, {
      status: result.status,
      output: result.output ?? null,
      usage: result.usage ?? null,
      error: result.error ?? null,
      sessionId: result.sessionId ?? undefined,
    });
    finalizeAndRecord(run, result.status, result.output ?? result.error ?? null);
    return true;
  } catch (err) {
    // 404 → the backend no longer knows this run. Terminal, but only once it
    // has PERSISTED: a Hermes restart 404s every live run, and failing them all
    // on the first observation is a fleet-wide false negative (T-0078).
    if (err instanceof RuntimeRequestError && err.status === 404) {
      // Inside the grace, fall THROUGH to the deadline check below rather than
      // returning early: the grace delays a 404 verdict, and must never become
      // a way for a permanently-404ing backend to hold the single-flight gate
      // open past the run's own deadline.
      if (notFoundPersisted(run.id)) {
        updateRun(run.id, { status: "failed", error: "backend no longer has this run (404)" });
        finalizeAndRecord(run, "failed", "backend lost the run");
        return true;
      }
    }
    // Transient (gateway down / timeout). Self-heal: if the run is older than its
    // deadline, the backend has been unreachable past the point we'd expect a
    // result — fail it so the mission clears and the scheduler isn't blocked.
    const cap = declared ?? DEFAULT_MAX_RUN_MINUTES;
    if (age > cap + GRACE_MINUTES) {
      const msg = "backend unreachable past the run deadline";
      updateRun(run.id, { status: "failed", error: msg });
      finalizeMissionForRun(run.missionId, "failed", msg);
      return true;
    }
    // Otherwise leave active and retry next tick.
    return false;
  }
}

/** Reconcile all non-terminal runs. Returns the number that advanced. */
export async function reconcileActiveRuns(): Promise<number> {
  const active = listActiveRuns();
  let advanced = 0;
  for (const run of active) {
    if (await reconcileOne(run)) advanced += 1;
  }
  return advanced;
}

/**
 * Boot recovery. Runs that were 'started' when PatterStage stopped are still
 * tracked by the backend (HTTP runs survive a CH restart), so we just fail the
 * ones that never got a backend id; the rest are picked up by the next
 * reconcile tick. Network-free and safe to call at server boot.
 */
export function reconcileRunsOnBoot(): { failed: number } {
  const active = listActiveRuns();
  let failed = 0;
  for (const run of active) {
    if (!run.runId) {
      updateRun(run.id, {
        status: "failed",
        error: "PatterStage restarted before the run was submitted",
      });
      finalizeMissionForRun(run.missionId, "failed", "interrupted by a PatterStage restart");
      failed += 1;
    }
  }
  return failed > 0 ? { failed } : { failed: 0 };
}
