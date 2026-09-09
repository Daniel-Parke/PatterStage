import type { NextRequest } from "next/server";
// ═══════════════════════════════════════════════════════════════
// /api/models/sync/drift — detect config drift between DB and config.yaml
// ═══════════════════════════════════════════════════════════════

import { ok } from "@/lib/api-response";

import { buildDriftDetails, buildDriftLines, detectConfigDrift } from "@/modules/hermes/lib/sync-manager";
import type { SyncDrift } from "@/components/models/types";
import { route } from "@/lib/api-route";

export const GET = route("GET /api/models/sync/drift", "detecting drift", "Failed to detect drift", async (_request: NextRequest) => {
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
});