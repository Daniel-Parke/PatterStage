// ═══════════════════════════════════════════════════════════════
// /api/models/sync/drift — detect config drift between DB and config.yaml
// ═══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";
import { logApiError } from "@/lib/api-logger";
import { requireAuth } from "@/lib/api-auth";
import { detectConfigDrift } from "@/lib/sync-manager";
import { serverError } from "@/lib/api-response";
import type { SyncDrift } from "@/components/models/types";

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

  try {
    const drift = detectConfigDrift();

    // Transform DriftReport → SyncDrift for the UI
    const driftDetails: string[] = [];
    if (drift.primaryDiffers) {
      driftDetails.push(
        `Primary model drift: DB has "${drift.primaryDiffers.dbModel}", Hermes has "${drift.primaryDiffers.hermesModel}"`
      );
    }
    for (const m of drift.modelsInHermesNotInDb) {
      driftDetails.push(`Model "${m.modelId}" (${m.provider}) is in Hermes but not in Control Hub`);
    }
    for (const m of drift.modelsInDbNotInHermes) {
      driftDetails.push(`Model "${m.modelId}" (${m.provider}) is in Control Hub but not pushed to Hermes`);
    }

    const syncDrift: SyncDrift = {
      hasDrift: driftDetails.length > 0,
      driftDetails,
    };

    return NextResponse.json({ data: syncDrift });
  } catch (error) {
    logApiError("GET /api/models/sync/drift", "detecting drift", error);
    return serverError("Failed to detect drift");
  }
}