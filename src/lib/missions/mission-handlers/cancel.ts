// ═══════════════════════════════════════════════════════════════
// mission-handlers/cancel.ts — POST /api/missions { action: "cancel" }
// ═══════════════════════════════════════════════════════════════
//
// The unified V1 status enum has no `cancelled` state — cancellations
// are recorded as `failed` with an explicit "Cancelled by user" result.
// A running mission's backend run is stopped over HTTP (no pid/signal).
// Extracted from the /api/missions route.

import { NextResponse } from "next/server";

import { logApiError } from "@/lib/api-logger";
import { ok, notFound } from "@/lib/api-response";
import { finaliseCancelledMission } from "@/lib/missions/cancel-finalise";
import { stopBackendRunForMission } from "@/lib/orchestration";
import { recordEvent } from "@/lib/analytics/record-event";

import { requireMissionOrNotFound } from "./shared";

export function handleCancelMission(body: Record<string, unknown>): NextResponse {
  const existingMission = requireMissionOrNotFound(body);
  if (existingMission instanceof NextResponse) return existingMission;

  const cancelId = existingMission.id;
  // One writer for the local record, shared with POST /api/missions/[id]/cancel
  // so the two entry points cannot leave different state. It writes the RUN row
  // synchronously, which the board's "Cancelled" label depends on: reaching
  // that row only through the background stop below would show "Failed" for as
  // long as the backend took to answer (T-0070).
  const mission = finaliseCancelledMission(cancelId);
  if (!mission)
    return notFound("Mission not found");
  // Both doors (this handler and POST /api/missions/[id]/cancel) come through
  // here, so the ledger is written once per cancellation (T-0098).
  recordEvent("mission.cancelled", { entityType: "mission", entityId: cancelId });

  const shouldKillProcess = existingMission.status === "dispatched";
  if (shouldKillProcess) {
    // Stop the backend run over HTTP (runtime.stopRun) — no pid/signal. The
    // local record is already written; this is the remote half only, and it is
    // deliberately NOT cancelMissionRun, which would finalise and audit a
    // second time.
    void stopBackendRunForMission(cancelId).catch((err: unknown) => {
      logApiError("POST /api/missions", "stopBackendRunForMission (background)", err);
    });
  }
  return ok({
    mission,
    cancel: {
      accepted: true,
      processKillPending: shouldKillProcess,
    },
  });
}
