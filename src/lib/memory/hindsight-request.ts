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
export function isHindsightConnectionError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message;
  return (
    msg.includes("connect") ||
    msg.includes("ECONNREFUSED") ||
    msg.includes("refused") ||
    msg.includes("timed out")
  );
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
