// ═══════════════════════════════════════════════════════════════
// Gateway Models — Proxy to Hermes Gateway /v1/models
// ═══════════════════════════════════════════════════════════════
// GET /api/gateway/models — Fetch available models from gateway.
// Returns { data: { models: string[] } } or falls back gracefully.
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";

const DEFAULT_MODELS = [
  "hermes-agent",
  "deepseek/deepseek-v4-flash",
  "anthropic/claude-sonnet-4",
];

/** GET /api/gateway/models — List models from Hermes Gateway. */
export async function GET() {
  try {
    const res = await fetch("http://127.0.0.1:8642/v1/models", {
      method: "GET",
      signal: AbortSignal.timeout(3000),
    });

    if (res.ok) {
      const json = await res.json();
      // OpenAI-compatible /v1/models returns { data: [{ id: "model-name", ... }] }
      if (json.data && Array.isArray(json.data)) {
        const models = json.data.map((m: { id: string }) => m.id).filter(Boolean);
        if (models.length > 0) {
          return NextResponse.json({ data: { models } });
        }
      }
      // Fallback: raw array of strings
      if (Array.isArray(json.data)) {
        return NextResponse.json({ data: { models: json.data } });
      }
    }

    // Gateway unreachable — return default model list
    return NextResponse.json({ data: { models: DEFAULT_MODELS } });
  } catch {
    return NextResponse.json({ data: { models: DEFAULT_MODELS } });
  }
}
