// ═══════════════════════════════════════════════════════════════
// mission-handlers/delete.ts — POST /api/missions { action: "delete" }
// ═══════════════════════════════════════════════════════════════
//
// Deletes a mission and removes any PatterStage schedule linked to it
// so the scheduler tick never tries to dispatch a deleted mission.
// Extracted from the /api/missions route.

import { NextResponse } from "next/server";

import { deleteMission } from "@/lib/missions/mission-repository";
import { ok, notFound } from "@/lib/api-response";
import { appendAuditLine } from "@/lib/audit-log";
import { deleteSchedulesForMission } from "@/lib/schedules-repository";

import { requireMissionOrNotFound } from "./shared";

export function handleDeleteMission(body: Record<string, unknown>): NextResponse {
  const existing = requireMissionOrNotFound(body);
  if (existing instanceof NextResponse) return existing;

  const missionIdFinal = existing.id;
  // Remove any CH schedule linked to this mission so the scheduler tick
  // never tries to dispatch a deleted mission.
  deleteSchedulesForMission(missionIdFinal);

  const deleted = deleteMission(missionIdFinal);
  if (!deleted)
    return notFound("Mission not found");

  appendAuditLine({ action: "mission.delete", resource: missionIdFinal, ok: true });
  return ok({ deleted: missionIdFinal });
}
