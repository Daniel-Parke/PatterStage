// ═══════════════════════════════════════════════════════════════
// hermes-state-sessions.ts: speaking the agent's end_reason vocabulary
//
// Split out of session-sync.ts, and since narrowed. The reader that
// opened the agent's state.db has moved to src/lib/runtime/state-db.ts,
// which is the layer licensed to know the agent's on-disk layout; a
// *repository* name would have silenced `sql-outside-repository` by
// matching its /repository/i exemption rather than by putting the code
// anywhere better.
//
// What stays is the translation: the `end_reason` values the agent uses
// to say how a session ended, mapped into PatterStage's own terms
// (SessionStatus + exit code). It lives in the sessions domain because
// it is about what a PatterStage session row means, and it has no IO.
// ═══════════════════════════════════════════════════════════════

import { type SessionStatus } from "./session-repository";

/**
 * Translate the agent's `end_reason` vocabulary into PatterStage's
 * (status, exitCode) pair. A null reason means the session is still
 * running; an unrecognised one is treated as a clean end with an
 * unknown exit code rather than a failure, because a reason we have
 * not seen before is not evidence of an error.
 */
export function hermesStatusFromEndReason(
  end_reason: string | null,
): { status: SessionStatus; exitCode: number | null } {
  if (!end_reason) return { status: "active", exitCode: null };
  switch (end_reason) {
    case "stop":
    case "token_limit":
    case "max_iterations":
      return { status: "completed", exitCode: 0 };
    case "timeout":
      return { status: "completed", exitCode: 143 };
    // `interrupt` is somebody stopping the run, and PatterStage's own cancel
    // writes `failed` with exit 143 for exactly that. Mapping it to `completed`
    // meant one event read two ways and whichever writer won the race decided
    // what the operator saw (T-0070). The board still LABELS it "Cancelled",
    // from the run row; this is the storage, not the display.
    case "interrupt":
      return { status: "failed", exitCode: 143 };
    case "error":
      return { status: "failed", exitCode: 1 };
    default:
      return { status: "completed", exitCode: null };
  }
}
