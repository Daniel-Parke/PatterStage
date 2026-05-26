// ═══════════════════════════════════════════════════════════════
// /api/models/sync/drift — detect config drift between DB and config.yaml
// ═══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";
import { logApiError } from "@/lib/api-logger";
import { requireAuth } from "@/lib/api-auth";
import { detectConfigDrift } from "@/lib/sync-manager";

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

  try {
    const drift = detectConfigDrift();
    return NextResponse.json({ data: drift });
  } catch (error) {
    logApiError("GET /api/models/sync/drift", "detecting drift", error);
    return NextResponse.json({ error: "Failed to detect drift" }, { status: 500 });
  }
}