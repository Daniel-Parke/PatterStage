// ═══════════════════════════════════════════════════════════════
// Gateway Health Check — Proxied through CH to avoid CORS issues
// ═══════════════════════════════════════════════════════════════
// GET /api/gateway/health
// ═══════════════════════════════════════════════════════════════

import { logApiError } from "@/lib/api-logger";
import { fetchGateway } from "@/lib/gateway-client";
import { ok } from "@/lib/api-response";

/**
 * GET /api/gateway/health — Check if the Hermes Gateway is reachable AND
 * whether Control Hub can authenticate to it.
 *
 * `online`: any HTTP response (incl. 401/403) proves the gateway answered →
 * reachable. Only a thrown/timed-out fetch means offline.
 * `authConfigured`: false when the gateway rejects our bearer key (401/403) —
 * i.e. the gateway is UP but `API_SERVER_KEY` is missing/wrong. The chat page
 * uses this to show an actionable "set the key" banner instead of a misleading
 * "Gateway Offline".
 */
export async function GET() {
  try {
    const res = await fetchGateway("/v1/models", { method: "GET" });
    const authConfigured = res.status !== 401 && res.status !== 403;
    return ok({ online: true, authConfigured });
  } catch (error) {
    logApiError("GET /api/gateway/health", "gateway probe", error);
    return ok({ online: false, authConfigured: false });
  }
}
