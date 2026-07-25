// ═══════════════════════════════════════════════════════════════
// /api/models/sync/drift — detect config drift between DB and config.yaml
// ═══════════════════════════════════════════════════════════════
import { NextRequest } from "next/server";
import { ok } from "@/lib/api-response";
import { serverErrorFromCatch } from "@/lib/api-logger";
import { requireAuth } from "@/lib/api-auth";
import { buildDriftDetails, detectConfigDrift } from "@/modules/hermes/lib/sync-manager";
import type { SyncDrift } from "@/components/models/types";

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

  try {
    const driftDetails = buildDriftDetails(detectConfigDrift());

    const syncDrift: SyncDrift = {
      hasDrift: driftDetails.length > 0,
      driftDetails,
    };

    return ok(syncDrift);
  } catch (error) {
    return serverErrorFromCatch(
      "GET /api/models/sync/drift",
      "detecting drift",
      error,
      "Failed to detect drift",
    );
  }
}