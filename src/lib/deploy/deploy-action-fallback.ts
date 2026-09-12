// ═══════════════════════════════════════════════════════════════
// deploy-action-fallback.ts — Pure helper for the Sidebar's deploy
// action error message fallback.
// ═══════════════════════════════════════════════════════════════
//
// The Sidebar's three deploy actions (update, restart, rebuild) all
// post to /api/update. When the response is non-2xx, the catch block
// needs a sensible fallback message; the catch block can't trust
// `err.message` to be non-empty (e.g. an `AbortError` from a
// network failure throws a generic message).
//
// The convention the inline form followed: take the startedMessage
// ("Update started — deploying in background...") and replace the
// tail ("started …") with "failed". The regex `started.*$` is
// tight enough to match the exact shape of the 3 messages used
// in the Sidebar, and broad enough to handle the variable
// punctuation.
//
// Extracted here as a pure function so the convention is
// testable in isolation from React. The 3 messages in the
// Sidebar all share the pattern "X started…", so the regex
// matches them; a 4th message that doesn't include "started"
// would surface as the literal input — the caller is responsible
// for choosing a startedMessage that follows the convention.

/**
 * Derive a sensible "action failed" fallback from the action's
 * startedMessage. Replaces the trailing "started …" with "failed".
 *
 * @example
 *   fallbackForDeployMessage("Update started — deploying in background...")
 *   // → "Update failed"
 *   fallbackForDeployMessage("Rebuild started…")
 *   // → "Rebuild failed"
 *   fallbackForDeployMessage("Started")            // no trailing "started" word
 *   // → "Started" (the regex doesn't match; returns the input)
 */
export function fallbackForDeployMessage(startedMessage: string): string {
  return startedMessage.replace(/started.*$/, "failed");
}
