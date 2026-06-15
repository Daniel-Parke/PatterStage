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

import { listActiveRuns, updateRun, type RunRecord } from "@/lib/runs-repository";
import { updateMission, getMission } from "@/lib/mission-repository";
import { closeSessionForMission } from "@/lib/session-repository";
import { runtime } from "@/lib/runtime";
import { now } from "@/lib/db";
import { RuntimeRequestError, type RunStatus } from "@/lib/runtime/types";

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
const GRACE_MINUTES = 5;
const DEFAULT_MAX_RUN_MINUTES = Math.max(10, Number(process.env.CH_RUN_MAX_MINUTES) || 120);

function parseTs(s: string): number {
  const hasTz = s.endsWith("Z") || /[+-]\d\d:\d\d$/.test(s);
  return Date.parse(hasTz ? s : `${s}Z`);
}

function ageMinutes(run: RunRecord): number {
  const start = parseTs(run.submittedAt);
  return Number.isFinite(start) ? (Date.now() - start) / 60_000 : 0;
}

/** The mission's declared max runtime in minutes, if any (timeout wins). */
function declaredTimeoutMinutes(missionId: string | null): number | null {
  if (!missionId) return null;
  const m = getMission(missionId);
  const t = m?.timeoutMinutes ?? m?.missionTimeMinutes;
  return typeof t === "number" && t > 0 ? t : null;
}

/**
 * Apply a terminal run state to the linked mission + session. Idempotent:
 * safe if the mission/session were already closed.
 */
export function finalizeMissionForRun(
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

/** Poll one active run and write any terminal transition. Returns true if it advanced. */
async function reconcileOne(run: RunRecord): Promise<boolean> {
  // Never got a backend id — submit failed/crashed mid-flight.
  if (!run.runId) {
    updateRun(run.id, { status: "failed", error: "run was never submitted to the backend" });
    finalizeMissionForRun(run.missionId, "failed", "run was never submitted to the backend");
    return true;
  }

  const age = ageMinutes(run);
  const declared = declaredTimeoutMinutes(run.missionId);

  try {
    const result = await runtime.getRun(run.runId, run.profileName ?? undefined);
    if (result.status === "started") {
      // Enforce a DECLARED timeout even if the backend still reports running, so
      // a runaway mission can't hold the single-flight gate forever.
      if (declared !== null && age > declared + GRACE_MINUTES) {
        await runtime.stopRun(run.runId, run.profileName ?? undefined).catch(() => {});
        const msg = `run exceeded its ${declared}m timeout`;
        updateRun(run.id, { status: "failed", error: msg });
        finalizeMissionForRun(run.missionId, "failed", msg);
        return true;
      }
      return false; // still running, within its window
    }

    updateRun(run.id, {
      status: result.status,
      output: result.output ?? null,
      usage: result.usage ?? null,
      error: result.error ?? null,
      sessionId: result.sessionId ?? undefined,
    });
    finalizeMissionForRun(run.missionId, result.status, result.output ?? result.error ?? null);
    return true;
  } catch (err) {
    // 404 → the backend no longer knows this run; treat as terminal failure.
    if (err instanceof RuntimeRequestError && err.status === 404) {
      updateRun(run.id, { status: "failed", error: "backend no longer has this run (404)" });
      finalizeMissionForRun(run.missionId, "failed", "backend lost the run");
      return true;
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
 * Boot recovery. Runs that were 'started' when Control Hub stopped are still
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
        error: "Control Hub restarted before the run was submitted",
      });
      finalizeMissionForRun(run.missionId, "failed", "interrupted by a Control Hub restart");
      failed += 1;
    }
  }
  return failed > 0 ? { failed } : { failed: 0 };
}
