// ═══════════════════════════════════════════════════════════════
// mission-run-state.ts: "what is this mission doing right now"
//
// The mission board used to answer that question with one unlabelled
// clock icon and `timeAgo(mission.createdAt)`. For a dispatched mission
// that is the wrong number: a mission written last week and dispatched
// ten seconds ago read "7d", and the detail panel's "Elapsed" field was
// the same createdAt subtraction, so a run that had been going for two
// hours was indistinguishable from one that had just started.
//
// Nothing new is tracked here. The run row already carries submittedAt,
// completedAt, status and the backend's verbatim error, and the
// reconciler already knows the instant it will stop waiting for a run
// (src/lib/orchestration/run-deadline.ts). This module is the pure
// function that turns those facts into the four strings the UI renders,
// so the board and the detail panel cannot drift apart and neither has
// to do date arithmetic in JSX.
// ═══════════════════════════════════════════════════════════════

import { missionStatusLabel, type StatusLabel } from "@/lib/status-labels";

/**
 * The slice of a run row the console needs, plus the deadline the
 * reconciler will enforce. Built server-side by `buildMissionRunView`
 * so the client never has to guess at the timeout policy.
 */
export interface MissionRunView {
  /** PatterStage-owned run id (also the backend Idempotency-Key). */
  id: string;
  status: "started" | "completed" | "failed" | "cancelled";
  submittedAt: string;
  completedAt: string | null;
  /** The backend's failure text, verbatim. Null when the run did not fail. */
  error: string | null;
  /**
   * Instant at which the reconciler stops waiting for a still-running run.
   * Null once the run is terminal (nothing is waiting any more).
   */
  deadlineAt: string | null;
  /** True when `deadlineAt` came from the mission's declared timeout, false when it is the safety cap. */
  deadlineDeclared: boolean;
}

/** How the row should read. Maps to colour at the call site, never here. */
/**
 * `stopped` is deliberately not `bad`. A cancellation is something the
 * operator asked for, and painting it in the failure colour told them their
 * own action had gone wrong.
 */
export type MissionRunTone =
  | "idle"
  | "waiting"
  | "running"
  | "overdue"
  | "good"
  | "bad"
  | "stopped";

export interface MissionRunState {
  tone: MissionRunTone;
  /** The mission's word from the one vocabulary (src/lib/status-labels.ts): Draft, Queued, Running, Completed, Failed or Cancelled. */
  label: StatusLabel;
  /** The duration itself, e.g. "12s", "2h 14m". */
  duration: string;
  /** One short timing sentence the operator can act on, or null when there is nothing honest to say. */
  note: string | null;
}

export interface MissionRunStateInput {
  status: string;
  queuedForRun?: boolean;
  createdAt: string;
  updatedAt: string;
  run?: MissionRunView | null;
}

/** Parse an ISO-ish timestamp, tolerating the DB's tz-less form. */
function parseAt(value: string | null | undefined): number | null {
  if (!value) return null;
  const hasTz = value.endsWith("Z") || /[+-]\d\d:\d\d$/.test(value);
  const ms = Date.parse(hasTz ? value : `${value}Z`);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Format a millisecond span the way an operator reads a stopwatch.
 * Two units at most: seconds below a minute, then m+s, h+m, d+h.
 * Negative spans clamp to "0s" rather than rendering a minus sign.
 */
export function formatRunDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  if (total < 60) return `${total}s`;
  const minutes = Math.floor(total / 60);
  if (minutes < 60) return `${minutes}m ${total % 60}s`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

/** The span from `iso` to `now`, or null when `iso` is missing/unparseable. */
function since(iso: string | null | undefined, now: number): string | null {
  const at = parseAt(iso);
  return at === null ? null : formatRunDuration(now - at);
}

/**
 * Timing note for a dispatched mission whose run we can see.
 *
 * The two overdue sentences differ because the reconciler treats the two
 * deadlines differently: a declared timeout is enforced even while the
 * backend still reports the run as started, whereas the safety cap only
 * bites once the backend stops answering. Saying "will be failed" for
 * both would be a promise the reconciler does not make.
 */
function runningNote(run: MissionRunView, now: number): string | null {
  const deadline = parseAt(run.deadlineAt);
  if (deadline === null) return null;
  if (now >= deadline) {
    return run.deadlineDeclared
      ? "past its declared timeout - the next reconcile tick will fail this run"
      : "past the safety cap - the reconciler will fail it once the backend stops answering";
  }
  const source = run.deadlineDeclared ? "declared timeout" : "safety cap";
  return `${formatRunDuration(deadline - now)} left before the ${source}`;
}

/**
 * Describe a mission's run state from what the system already stores.
 *
 * `now` is a parameter rather than a `Date.now()` call so the function is
 * pure and the caller can hold one clock reading across a whole list.
 */
export function describeMissionRunState(
  mission: MissionRunStateInput,
  now: number,
): MissionRunState {
  const { status, run } = mission;

  if (status === "queued") {
    const waiting = mission.queuedForRun === true;
    return {
      tone: waiting ? "waiting" : "idle",
      label: missionStatusLabel({ status, queuedForRun: waiting }),
      duration: since(mission.createdAt, now) ?? "—",
      note: null,
    };
  }

  if (status === "dispatched") {
    // Anchor on the run row when there is one; it is the moment the backend
    // accepted the work. Without it, the mission's updatedAt is the moment
    // dispatch flipped the status, and nothing writes to the mission again
    // while it is dispatched, so it is the same instant, one table over.
    const anchor = run?.submittedAt ?? mission.updatedAt;
    const note = run ? runningNote(run, now) : null;
    const overdue =
      run?.deadlineAt != null && now >= (parseAt(run.deadlineAt) ?? Number.POSITIVE_INFINITY);
    return {
      tone: overdue ? "overdue" : "running",
      label: "Running",
      duration: since(anchor, now) ?? "—",
      note,
    };
  }

  const finishedAt = run?.completedAt ?? mission.updatedAt;
  const ago = since(finishedAt, now);

  // A cancellation is recorded on the mission as `failed` with the result
  // "Cancelled by user", because the mission enum has no `cancelled` and the
  // operator ruled it stays that way. The RUN row does carry it, honestly, and
  // was simply not being read -- so the board painted a deliberate stop in the
  // same red as a crash, with no way to tell them apart (T-0070).
  if (run?.status === "cancelled") {
    return {
      tone: "stopped",
      label: "Cancelled",
      duration: ago ? `${ago} ago` : "—",
      note: "Stopped by the operator",
    };
  }

  return {
    tone: status === "successful" ? "good" : "bad",
    label: missionStatusLabel({ status }),
    duration: ago ? `${ago} ago` : "—",
    note: null,
  };
}
