import type { NextRequest } from "next/server";
// ═══════════════════════════════════════════════════════════════
// /api/models/sync/drift — detect config drift between DB and config.yaml
// ═══════════════════════════════════════════════════════════════

import { ok } from "@/lib/api-response";
import { serverErrorFromCatch } from "@/lib/api-logger";

import { buildDriftDetails, buildDriftLines, detectConfigDrift } from "@/modules/hermes/lib/sync-manager";
import type { SyncDrift } from "@/components/models/types";

export async function GET(_request: NextRequest) {
  try {
    // One report, read twice: the sentences the banner prints and the lines
    // it hangs a Pull or a Push on. `lines[i].text === driftDetails[i]`.
    const report = detectConfigDrift();
    const driftDetails = buildDriftDetails(report);

    const syncDrift: SyncDrift = {
      hasDrift: driftDetails.length > 0,
      driftDetails,
      lines: buildDriftLines(report),
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