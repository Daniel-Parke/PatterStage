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
 * Resolve the banner message for a `health: HealthState` payload.
 *
 *   1. `health.error?.includes("Redis")` → "Redis is not running.
 *      Start Redis to enable memory features: redis-server"
 *   2. `health.message` is set → "Hindsight <mode>: <message>"
 *   3. otherwise → "Hindsight <mode>: <error || 'not responding'>"
 *
 * The order matters: case 1 wins over case 2 because a Redis-related
 * error often comes with a generic "Connection refused" message and we
 * want the actionable Redis hint to surface.
 */
export function healthBannerMessage(health: HealthState): string {
  if (health.error?.includes(REDIS_TOKEN)) {
    return "Redis is not running. Start Redis to enable memory features: redis-server";
  }
  if (health.message) {
    return `Hindsight ${health.mode}: ${health.message}`;
  }
  return `Hindsight ${health.mode}: ${health.error || NOT_RESPONDING}`;
}
