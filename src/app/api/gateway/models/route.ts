// ═══════════════════════════════════════════════════════════════
// Gateway Models — Proxy to Hermes Gateway /v1/models
// ═══════════════════════════════════════════════════════════════
// GET /api/gateway/models — Fetch available models from gateway.
// Returns { data: { models: string[] } } or falls back gracefully.
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { logApiError } from "@/lib/api-logger";
import { fetchGateway } from "@/lib/gateway-client";

const DEFAULT_MODELS = [
  "hermes-agent",
  "deepseek/deepseek-v4-flash",
  "anthropic/claude-sonnet-4",
];

/** GET /api/gateway/models — List models from Hermes Gateway. */
export async function GET() {
  try {
    const res = await fetchGateway("/v1/models", { method: "GET" });
    if (res.ok) {
      const models = parseModelList(await res.json());
      if (models.length > 0) {
        return NextResponse.json({ data: { models } });
      }
    }
    return NextResponse.json({ data: { models: DEFAULT_MODELS } });
  } catch (error) {
    logApiError("GET /api/gateway/models", "listing gateway models", error);
    return NextResponse.json({ data: { models: DEFAULT_MODELS } });
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
