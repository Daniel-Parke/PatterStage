// hindsight-request.ts - the transport the Hindsight actions share. Every
// action goes through `requestWithTimeout`, the active memory provider's
// request(); host, port and bank come from the provider config, never a hardcoded localhost:9177.

import { getActiveMemoryProvider, getActiveMemoryConfig } from "@/lib/memory/memory-providers";

/**
 * "Hindsight is not running" (a 503 and an empty state) rather than "Hindsight
 * is broken" (a 500). It reads the CAUSE CHAIN, not just the message: Node's
 * fetch hides `ECONNREFUSED` one level down in `cause`, so matching the
 * message alone returned 500 for the commonest case, the service not being up.
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

// The provider's request() preserves the error-message shape isHindsightConnectionError matches.

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
