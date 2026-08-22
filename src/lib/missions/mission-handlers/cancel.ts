// ═══════════════════════════════════════════════════════════════
// mission-handlers/cancel.ts — POST /api/missions { action: "cancel" }
// ═══════════════════════════════════════════════════════════════
//
// The unified V1 status enum has no `cancelled` state — cancellations
// are recorded as `failed` with an explicit "Cancelled by user" result.
// A running mission's backend run is stopped over HTTP (no pid/signal).
// Extracted from the /api/missions route.

import { NextResponse } from "next/server";

import { updateMission } from "@/lib/missions/mission-repository";
import { updateSession } from "@/lib/session-repository";
import { logApiError } from "@/lib/api-logger";
import { ok, notFound } from "@/lib/api-response";
import { appendAuditLine } from "@/lib/audit-log";
import { cancelMissionRun } from "@/lib/orchestration";

import { requireMissionOrNotFound } from "./shared";

export function handleCancelMission(body: Record<string, unknown>): NextResponse {
  const existingMission = requireMissionOrNotFound(body);
  if (existingMission instanceof NextResponse) return existingMission;

  const cancelId = existingMission.id;
  const mission = updateMission(cancelId, {
    status: "failed",
    result: "Cancelled by user",
    queuedForRun: false,
  });
  if (!mission)
    return notFound("Mission not found");

  if (mission.sessionId) {
    try {
      updateSession(mission.sessionId, {
        status: "failed",
        endedAt: new Date().toISOString(),
        error: "Cancelled by user",
      });
    } catch (err) {
      logApiError("POST /api/missions", "cancelMission session update", err);
    }
  }

  const shouldKillProcess = existingMission.status === "dispatched";
  if (shouldKillProcess) {
    // Stop the backend run over HTTP (runtime.stopRun) — no pid/signal.
    void cancelMissionRun(cancelId).catch((err: unknown) => {
      logApiError("POST /api/missions", "cancelMissionRun (background)", err);
    });
  }

  appendAuditLine({ action: "mission.cancel", resource: cancelId, ok: true });
  return ok({
    mission,
    cancel: {
      accepted: true,
      processKillPending: shouldKillProcess,
    },
  });
}
