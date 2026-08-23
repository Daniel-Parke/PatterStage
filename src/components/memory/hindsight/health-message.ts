// ═══════════════════════════════════════════════════════════════
// healthBannerMessage — build the Hindsight "not responding" message
// ═══════════════════════════════════════════════════════════════
//
// HealthBanner.tsx had a 6-line inline ternary that decided the
// banner message based on three `health` fields:
//
//   1. If `health.error` mentions "Redis" → "Redis is not running..."
//   2. Else if `health.message` is set → "Hindsight <mode>: <message>"
//   3. Else → "Hindsight <mode>: <error or 'not responding'>"
//
// The 3-branch decision is small but worth extracting for two reasons:
//   1. **Testability** — the Redis detection is a substring heuristic
//      that can match partial substrings ("refused to start" contains
//      nothing Redis-related, but "RedisConnectionError" should match).
//      Unit tests pin down the exact matching behaviour so a future
//      tightening to word-boundary matches is a deliberate change.
//   2. **The HealthState shape is reused** — when a future consumer
//      (e.g. a Hindsight settings page) needs the same banner, the
//      helper is the single source of truth.

import type { HealthState } from "@/components/memory/hindsight/types";

/** Substring token that triggers the "Redis is not running" branch. */
const REDIS_TOKEN = "Redis";

/** Fallback message when neither `error` nor `message` is set. */
const NOT_RESPONDING = "not responding";

/**
 * What a transport failure looks like on the wire. The health route answers 200
 * with `{ available: false, error: "fetch failed" }` when nothing is listening,
 * and "fetch failed" is Node's phrasing, not an instruction to anybody. Someone
 * who has installed PatterStage but not a memory provider needs to be told that
 * is what happened.
 */
const TRANSPORT_ERRORS = ["fetch failed", "ECONNREFUSED", "Connection refused", "ETIMEDOUT"];

/**
 * "Hindsight <mode>", or plain "Hindsight" when the payload carried no mode.
 * An unreachable provider answers without one, which used to render the literal
 * string "Hindsight undefined:".
 */
function label(mode: string | undefined): string {
  return mode ? `Hindsight ${mode}` : "Hindsight";
}

/**
 * Resolve the banner message for a `health: HealthState` payload.
 *
 *   1. `health.error?.includes("Redis")` → "Redis is not running.
 *      Start Redis to enable memory features: redis-server"
 *   2. `health.message` is set → "Hindsight <mode>: <message>"
 *   3. the error is a bare transport failure → the plain-English
 *      "nothing is answering, and that is survivable" sentence
 *   4. otherwise → "Hindsight <mode>: <error || 'not responding'>"
 *
 * The order matters: case 1 wins over case 2 because a Redis-related
 * error often comes with a generic "Connection refused" message and we
 * want the actionable Redis hint to surface. Case 3 sits below the
 * message branch so a provider that explains itself is always quoted
 * verbatim, and only Node's own "fetch failed" gets translated.
 */
export function healthBannerMessage(health: HealthState): string {
  if (health.error?.includes(REDIS_TOKEN)) {
    return "Redis is not running. Start Redis to enable memory features: redis-server";
  }
  if (health.message) {
    return `${label(health.mode)}: ${health.message}`;
  }
  if (health.error && TRANSPORT_ERRORS.some((token) => health.error?.includes(token))) {
    return "No memory provider is answering at the host and port configured above. PatterStage works without one; memory stays empty until a provider is running.";
  }
  return `${label(health.mode)}: ${health.error || NOT_RESPONDING}`;
}
