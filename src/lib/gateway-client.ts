// ═══════════════════════════════════════════════════════════════
// gateway-client.ts — Shared Hermes gateway HTTP helpers
// ═══════════════════════════════════════════════════════════════

import { getAgentGateway } from "./runtime/gateway";
import { getGatewayKey } from "./runtime/secrets";

/**
 * Build a full URL under the configured agent gateway base.
 */
export function gatewayUrl(path: string): string {
  const { baseUrl } = getAgentGateway();
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl}${suffix}`;
}

/**
 * Fetch JSON from the gateway with a timeout.
 *
 * Forwards the `Authorization: Bearer <API_SERVER_KEY>` header (via
 * `getGatewayKey()`) whenever a key is configured — the same auth the
 * runtime adapter uses (HermesRuntime). Without this, the proxy routes
 * (`/api/gateway/health`, `/api/gateway/models`) hit a key-required
 * gateway unauthenticated and get a 401, which the chat page misreads
 * as "offline" and which empties the model dropdown. Caller-supplied
 * headers win on collision (so a caller can override/omit auth).
 */
export async function fetchGateway(
  path: string,
  init?: RequestInit & { timeoutMs?: number }
): Promise<Response> {
  const timeoutMs = init?.timeoutMs ?? 3000;
  const { timeoutMs: _drop, headers, ...rest } = init ?? {};
  const key = getGatewayKey();
  const authHeader: Record<string, string> = key
    ? { Authorization: `Bearer ${key}` }
    : {};
  return fetch(gatewayUrl(path), {
    ...rest,
    headers: { ...authHeader, ...headers },
    signal: AbortSignal.timeout(timeoutMs),
  });
}
