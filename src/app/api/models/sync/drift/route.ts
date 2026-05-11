// ═══════════════════════════════════════════════════════════════
// /api/models/sync/drift — detect config drift between DB and config.yaml
// No auth required (read-only diagnostic)
// ═══════════════════════════════════════════════════════════════
import { NextResponse } from "next/server";
import { logApiError } from "@/lib/api-logger";
import { detectConfigDrift } from "@/lib/sync-manager";

export async function GET() {
  try {
    const drift = detectConfigDrift();
    return NextResponse.json({ data: drift });
  } catch (error) {
    logApiError("GET /api/models/sync/drift", "detecting drift", error);
    return NextResponse.json({ error: "Failed to detect drift" }, { status: 500 });
  }
}