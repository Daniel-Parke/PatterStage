// ══════════════════════════════════════════════════════════════
// /api/models/sync/pull — pull single model from Hermes → DB
// Wrapper that receives modelId from body
// ══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";
import { requireMcApiKey, requireNotReadOnly } from "@/lib/api-auth";
import { logApiError } from "@/lib/api-logger";
import { pullCredentialFromEnv } from "@/lib/sync-manager";

export async function POST(request: NextRequest) {
  const ro = requireNotReadOnly();
  if (ro) return ro;
  const auth = requireMcApiKey(request);
  if (auth) return auth;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { modelId } = (raw as Record<string, string>) ?? {};
  if (!modelId) {
    return NextResponse.json({ error: "modelId is required" }, { status: 400 });
  }

  try {
    // For now, the pull checks credential values from .env
    // and reports them back. Full model pull is handled by
    // /api/models/[id]/pull route.
    const result = pullCredentialFromEnv(modelId);
    return NextResponse.json({ data: result });
  } catch (error) {
    logApiError("POST /api/models/sync/pull", `pulling model ${modelId}`, error);
    return NextResponse.json({ error: "Failed to pull model" }, { status: 500 });
  }
}
