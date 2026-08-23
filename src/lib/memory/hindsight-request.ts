// ═══════════════════════════════════════════════════════════════
// hindsight-request.ts - the transport the Hindsight actions share
// ═══════════════════════════════════════════════════════════════
//
// Extracted from src/app/api/memory/hindsight/route.ts. Every action in
// hindsight-read-actions.ts and hindsight-write-actions.ts goes through
// `requestWithTimeout`, which is the active memory provider's request()
// under another name. Host, port and default bank come from the provider
// config (see /config/memory), never from a hardcoded localhost:9177.

import { getActiveMemoryProvider, getActiveMemoryConfig } from "@/lib/memory/memory-providers";

/**
 * Heuristic for "is this a connection-level failure?" — used to
 * downgrade the catch-branch response status from 500 to 503 (the
 * Hindsight server isn't responding, so it's not really a code bug).
 * The original `requestWithTimeout` error message already includes
 * the upstream status + body, so the match must look at substrings
 * of `error.message`, not at `error.name` or a typed `code` field.
 */
/**
 * Is this "Hindsight is not running" rather than "Hindsight is broken"?
 *
 * The distinction is the whole point: a connection failure is a 503 and an
 * empty state that says the service is down, while anything else is a 500 and
 * a real error. Getting it wrong means a user who simply has not started
 * Hindsight sees a server error.
 *
 * It reads the CAUSE CHAIN, not just the message. Node's fetch throws
 * `TypeError: fetch failed` and hides the real reason one level down in
 * `cause` (`Error: connect ECONNREFUSED 127.0.0.1:9177`). Matching on the
 * message alone therefore missed the single commonest case, the service not
 * being up, and returned 500 for it. Found 2026-08-23 by loading /memory with
 * Hindsight stopped and watching the console log a server error.
 */
export function isHindsightConnectionError(error: unknown): boolean {
  const NEEDLES = ["connect", "econnrefused", "refused", "timed out", "timeout",
                   "fetch failed", "network", "socket hang up", "enotfound", "ehostunreach"];
  // Walk `cause` to a sane depth; undici nests one level, but a wrapper could add more.
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current; depth++) {
    if (current instanceof Error) {
      const msg = current.message.toLowerCase();
      if (NEEDLES.some((n) => msg.includes(n))) return true;
      const code = (current as NodeJS.ErrnoException).code;
      if (code && ["ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "EHOSTUNREACH", "ECONNRESET"].includes(code)) return true;
      current = (current as { cause?: unknown }).cause;
    } else {
      return false;
    }
  }
  return false;
}

// ── DB-owned endpoint/bank ───────────────────────────────────
// Host/port/bank come from the active provider config (see /config/memory) —
// no more hardcoded localhost:9177 / "hermes". The provider's request()
// preserves the error-message shape isHindsightConnectionError matches.

/** The configured default bank (overridable per request via ?bank=). */
export function defaultBank(): string {
  return getActiveMemoryConfig().config.bank;
}

interface ApiOptions {
  method?: string;
  body?: Record<string, unknown>;
  timeoutMs?: number;
}

export async function requestWithTimeout<T = Record<string, unknown>>(
  path: string,
  opts: ApiOptions = {},
): Promise<T> {
  return getActiveMemoryProvider().request<T>(path, opts);
}
