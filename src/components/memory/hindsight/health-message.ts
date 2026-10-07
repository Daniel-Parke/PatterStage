// healthBannerMessage — the Hindsight "not responding" banner message.

import {
  MEMORY_NOT_ANSWERING,
  isMemoryTransportFailure,
  isMemoryUnavailableMessage,
} from "@/lib/memory/memory-error-copy";
import type { HealthState } from "@/components/memory/hindsight/types";

/** Substring token that triggers the "Redis is not running" branch. */
const REDIS_TOKEN = "Redis";

/** Fallback message when neither `error` nor `message` is set. */
const NOT_RESPONDING = "not responding";

/** "Hindsight <mode>", or "Hindsight" when the payload carried no mode: an
 * unreachable provider answers without one and used to render "Hindsight undefined:". */
function label(mode: string | undefined): string {
  return mode ? `Hindsight ${mode}` : "Hindsight";
}

/**
 * The banner message for a `health: HealthState` payload, in order:
 *   0. PatterStage's own no-provider notice → verbatim, because "Hindsight:"
 *      stamped on a sentence about there being no Hindsight is a contradiction
 *   1. the error mentions Redis → the actionable Redis hint, above the message
 *      branch because it usually arrives with a generic "Connection refused"
 *   2. `health.message` is set → "Hindsight <mode>: <message>"
 *   3. a bare transport failure → MEMORY_NOT_ANSWERING, shared with the store
 *      route via memory-error-copy so banner and toast describe one outage one
 *      way; below the message branch so a provider that explains itself is
 *      quoted verbatim and only Node's "fetch failed" is translated
 *   4. otherwise → "Hindsight <mode>: <error || 'not responding'>"
 */
export function healthBannerMessage(health: HealthState): string {
  if (health.error && isMemoryUnavailableMessage(health.error)) {
    return health.error;
  }
  if (health.error?.includes(REDIS_TOKEN)) {
    return "Redis is not running. Start Redis to enable memory features: redis-server";
  }
  if (health.message) {
    return `${label(health.mode)}: ${health.message}`;
  }
  if (health.error && isMemoryTransportFailure(health.error)) {
    return MEMORY_NOT_ANSWERING;
  }
  return `${label(health.mode)}: ${health.error || NOT_RESPONDING}`;
}
