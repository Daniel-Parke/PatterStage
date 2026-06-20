// ═══════════════════════════════════════════════════════════════
// Gateway Models — Proxy to Hermes Gateway /v1/models
// ═══════════════════════════════════════════════════════════════
// GET /api/gateway/models — Fetch available models from gateway.
// Returns { data: { models: string[] } } or an empty list when the
// gateway is offline. Empty (NOT a hardcoded fallback list) so the
// chat UI doesn't accidentally surface unrelated upstream models
// (e.g. "deepseek/deepseek-v4-flash") as user-selectable options
// that aren't in the PatterStage Models registry.
// ═══════════════════════════════════════════════════════════════

import { logApiError } from "@/lib/api-logger";
import { fetchGateway } from "@/lib/gateway-client";
import { ok } from "@/lib/api-response";

/** GET /api/gateway/models — List models from Hermes Gateway. */
export async function GET() {
  try {
    const res = await fetchGateway("/v1/models", { method: "GET" });
    if (res.ok) {
      const models = parseModelList(await res.json());
      // Empty list is a valid gateway response (e.g. gateway booted
      // with no providers) — surface it as-is instead of inventing
      // a fallback that might be picked up by the chat dropdown.
      return ok({ models });
    }
    return ok({ models: [] });
  } catch (error) {
    logApiError("GET /api/gateway/models", "listing gateway models", error);
    return ok({ models: [] });
  }
}

/** Normalise the gateway's /v1/models payload to a string[]. */
function parseModelList(
  json: { data?: Array<{ id: string }> | string[] } | null,
): string[] {
  if (!json?.data || !Array.isArray(json.data)) return [];
  return json.data
    .map((m) => (typeof m === "string" ? m : m.id))
    .filter((m): m is string => Boolean(m));
}
