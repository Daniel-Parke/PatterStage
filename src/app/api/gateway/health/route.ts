// ═══════════════════════════════════════════════════════════════
// Gateway Health Check — Proxied through CH to avoid CORS issues
// ═══════════════════════════════════════════════════════════════
// GET /api/gateway/health
// ═══════════════════════════════════════════════════════════════

import { logApiError } from "@/lib/api-logger";
import { fetchGateway } from "@/lib/gateway-client";
import { ok } from "@/lib/api-response";

/** GET /api/gateway/health — Check if Hermes Gateway is reachable. */
export async function GET() {
  try {
    const res = await fetchGateway("/v1/models", { method: "GET" });
    if (res.ok) {
      return ok({ online: true });
    }
    return ok({ online: false });
  } catch (error) {
    logApiError("GET /api/gateway/health", "gateway probe", error);
    return ok({ online: false });
  }
}
