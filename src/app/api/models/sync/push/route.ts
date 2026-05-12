// ═══════════════════════════════════════════════════════════════
// /api/models/sync/push — push single model DB → Hermes
// Wrapper that receives modelId from body and delegates to push
// ═══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";
import { requireMcApiKey, requireNotReadOnly } from "@/lib/api-auth";
import { logApiError } from "@/lib/api-logger";
import { pushModelToHermes } from "@/lib/sync-manager";

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
    const result = pushModelToHermes(modelId);
    return NextResponse.json({ data: result });
  } catch (error) {
    logApiError("POST /api/models/sync/push", `pushing model ${modelId}`, error);
    return NextResponse.json({ error: "Failed to push model" }, { status: 500 });
  }
}
