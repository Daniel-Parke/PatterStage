// ═══════════════════════════════════════════════════════════════
// mission-handlers/update.ts — POST /api/missions { action: "update" }
// ═══════════════════════════════════════════════════════════════
//
// In-place edit of a *running* (dispatched) mission. Draft/queued
// missions use promote instead. Extracted from the /api/missions route.

import { NextResponse } from "next/server";

import { updateMission } from "@/lib/missions/mission-repository";
import { badRequest, notFound } from "@/lib/api-response";
import { appendAuditLine } from "@/lib/audit-log";
import { buildMissionFieldPatch } from "@/lib/missions/mission-field-updates";
import { parseMissionBodyFields } from "@/lib/missions/mission-body";
import { missionTimeoutError } from "@/lib/missions/mission-timeout";
import { missionResponse } from "@/lib/missions/mission-response";

import { requireMissionOrNotFound, parseCategoryIdOrError } from "./shared";

export function handleUpdateMission(body: Record<string, unknown>): NextResponse {
  const { status, result, ...rest } = body as {
    id?: string;
    missionId?: string;
    status?: string;
    result?: string;
    [key: string]: unknown;
  };
  const timeoutError = missionTimeoutError(rest);
  if (timeoutError) return badRequest(timeoutError);
  const f = parseMissionBodyFields(rest);
  const { name, instruction, localDirs, references, skills, suggestedToolsets, goals, modelId, provider, profileName, missionTimeMinutes, timeoutMinutes, schedule, context, categoryId: categoryIdRaw, outputFormat, constraints } = f;
  const existing = requireMissionOrNotFound(body);
  if (existing instanceof NextResponse) return existing;
  const missionIdFinal = existing.id;

  const categoryId = parseCategoryIdOrError(categoryIdRaw);
  if (categoryId instanceof NextResponse) return categoryId;

  if (existing.status !== "dispatched") {
    // Name the CALL, not just the verb. The old message said "use promote" and
    // stopped -- but promote REQUIRES dispatchMode, which this did not mention,
    // so an operator who followed it literally earned a second 400 telling them
    // so. It also never said which state it had actually seen, which is what
    // makes the advice checkable (T-0071).
    return badRequest(
      `update applies to a running mission; this one is '${existing.status}'. ` +
        `To edit it without running it, send ` +
        `{"action":"promote","missionId":"${missionIdFinal}","dispatchMode":"save"} ` +
        `with the fields you want to change.`,
    );
  }

  const { updates } = buildMissionFieldPatch(
    existing,
    {
      status,
      result,
      name,
      instruction,
      context,
      localDirs,
      references,
      skills,
      suggestedToolsets,
      goals,
      modelId,
      provider,
      profileName,
      missionTimeMinutes,
      timeoutMinutes,
      schedule,
      outputFormat,
      constraints,
    },
    categoryId,
  );

  const mission = updateMission(missionIdFinal, updates);
  if (!mission)
    return notFound("Mission not found");

  appendAuditLine({ action: "mission.update", resource: missionIdFinal, ok: true });
  return missionResponse(missionIdFinal);
}
