// ═══════════════════════════════════════════════════════════════
// status-labels — one status vocabulary for every screen
//
// The same fact wore a different word on every surface: a finished mission
// was "Successful" on the dashboard badge, "Finished" on the board and
// "Completed" in the insights strip; a story was "Failed" on the hub and
// counted as "In Progress" in the library; a subsystem was "Not Installed"
// in a pill and "degraded" with a reason one panel over. The operator ratified
// thirteen words (decision 13, org/plans/2026-09-final-release.md), and this
// module is the only place a status becomes one of them.
//
//   Draft · Queued · Running · Waiting for you · Completed · Failed · Cancelled
//   Healthy · Degraded · Not running · Not installed
//   In sync · Out of sync
//
// The maps are typed against the real status unions with `satisfies`, so a
// status added to an enum without a word here is a compile error rather than
// a badge that reads its raw enum in title case.
// ═══════════════════════════════════════════════════════════════

import type { ComposerRunStatus } from "@/lib/composer/schema";
import type { SessionStatus } from "@/lib/sessions/session-repository";
import type { SubsystemState } from "@/lib/status/subsystems";
import type { MissionBoardColumn } from "@/lib/missions/mission-board";

export const STATUS_VOCABULARY = [
  "Draft",
  "Queued",
  "Running",
  "Waiting for you",
  "Completed",
  "Failed",
  "Cancelled",
  "Healthy",
  "Degraded",
  "Not running",
  "Not installed",
  "In sync",
  "Out of sync",
] as const;

export type StatusLabel = (typeof STATUS_VOCABULARY)[number];

/**
 * A mission's word. `queued` is Draft until the queue holds it, then Queued;
 * a mission the operator stopped is recorded as `failed` with a cancelled run
 * row (the mission enum has no cancelled state by ruling), so the run row is
 * what turns Failed into Cancelled.
 */
export function missionStatusLabel(mission: {
  status: string;
  queuedForRun?: boolean;
  runStatus?: string | null;
}): StatusLabel {
  if (mission.runStatus === "cancelled") return "Cancelled";
  switch (mission.status) {
    case "queued":
      return mission.queuedForRun ? "Queued" : "Draft";
    case "dispatched":
      return "Running";
    case "successful":
      return "Completed";
    case "failed":
      return "Failed";
    default:
      return "Draft";
  }
}

export const SESSION_STATUS_LABELS = {
  active: "Running",
  completed: "Completed",
  failed: "Failed",
} as const satisfies Record<SessionStatus, StatusLabel>;

/**
 * `rejected` is the gate the operator turned down, which stopped the run: the
 * operator's own act, so Cancelled rather than Failed.
 */
export const COMPOSER_RUN_STATUS_LABELS = {
  pending: "Queued",
  running: "Running",
  awaiting_approval: "Waiting for you",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
  rejected: "Cancelled",
} as const satisfies Record<ComposerRunStatus, StatusLabel>;

/**
 * A subsystem that is absent rather than down (no memory provider configured)
 * reads "Not installed"; the dashboard pill that says so is rebuilt in B5 and
 * takes the word from STATUS_VOCABULARY then.
 */
export const SUBSYSTEM_STATE_LABELS = {
  ok: "Healthy",
  degraded: "Degraded",
  down: "Not running",
} as const satisfies Record<SubsystemState, StatusLabel>;

export type SyncStatus = "synced" | "drift" | "error";

export const SYNC_STATUS_LABELS = {
  synced: "In sync",
  drift: "Out of sync",
  error: "Failed",
} as const satisfies Record<SyncStatus, StatusLabel>;

/**
 * The board's five columns, in the ratified words (decision 13).
 *
 * `satisfies StatusLabel` is what makes an off-vocabulary word a compile error
 * rather than a badge. It agrees with missionStatusLabel above.
 */
export const MISSION_COLUMN_LABELS = {
  draft: "Draft",
  queued: "Queued",
  dispatched: "Running",
  successful: "Completed",
  failed: "Failed",
} as const satisfies Record<MissionBoardColumn, StatusLabel>;
