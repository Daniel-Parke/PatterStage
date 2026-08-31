// ═══════════════════════════════════════════════════════════════
// Gateway Health Check — Proxied through CH to avoid CORS issues
// ═══════════════════════════════════════════════════════════════
// GET /api/gateway/health
// ═══════════════════════════════════════════════════════════════

import { logApiError } from "@/lib/api-logger";
import { fetchGateway } from "@/lib/gateway-client";
import { getAgentGateway } from "@/lib/runtime/gateway";
import { ok } from "@/lib/api-response";

/**
 * GET /api/gateway/health — Check if the Hermes Gateway is reachable AND
 * whether PatterStage can authenticate to it.
 *
 * `online`: any HTTP response (incl. 401/403) proves the gateway answered →
 * reachable. Only a thrown/timed-out fetch means offline.
 * `authConfigured`: false when the gateway rejects our bearer key (401/403) —
 * i.e. the gateway is UP but `API_SERVER_KEY` is missing/wrong. The chat page
 * uses this to show an actionable "set the key" banner instead of a misleading
 * "Gateway Offline".
 * `baseUrl`: WHICH gateway was probed. The offline banner used to name a
 * hardcoded port 8642 and said so while the gateway was on 8652, sending the
 * operator to fix a port that was not the one that was down (T-0080). Only the
 * server knows the answer, so only the server can supply it.
 *
 * The address is not a secret: `boot-diagnostics.ts` already prints it on every
 * boot, over an explicit ruling -- "HERMES_GATEWAY_URL is an address, not a
 * credential" -- taken for this exact confusion. The bearer key is never
 * returned here, and `authConfigured` says only whether one worked.
 */
export async function GET() {
  const { baseUrl } = getAgentGateway();
  try {
    const res = await fetchGateway("/v1/models", { method: "GET" });
    const authConfigured = res.status !== 401 && res.status !== 403;
    return ok({ online: true, authConfigured, baseUrl });
  } catch (error) {
    logApiError("GET /api/gateway/health", "gateway probe", error);
    return ok({ online: false, authConfigured: false, baseUrl });
  }
}
