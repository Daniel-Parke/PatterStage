// ═══════════════════════════════════════════════════════════════
// mission-handlers/promote.ts — POST /api/missions { action: "promote" }
// ═══════════════════════════════════════════════════════════════
//
// Promotes a draft / queued-waiting mission per the dispatch mode.
// The promotion logic itself lives in mission-promote-handler.ts; this
// handler is the request-parse + result→NextResponse mapping extracted
// from the /api/missions route god-file.

import { NextResponse } from "next/server";

import { ok, badRequest } from "@/lib/api-response";
import { appendAuditLine } from "@/lib/audit-log";
import { parseMissionBodyFields } from "@/lib/missions/mission-body";
import { missionTimeoutError } from "@/lib/missions/mission-timeout";
import { promoteMission } from "@/lib/missions/mission-promote-handler";

import { requireMissionId, parseCategoryIdOrError } from "./shared";

export async function handlePromoteMission(
  body: Record<string, unknown>,
): Promise<NextResponse> {
  const missionIdFinal = requireMissionId(body);
  if (missionIdFinal instanceof NextResponse) return missionIdFinal;

  const { dispatchMode, ...rest } = body as {
    dispatchMode?: string;
    [key: string]: unknown;
  };
  const timeoutError = missionTimeoutError(rest);
  if (timeoutError) return badRequest(timeoutError);
  const f = parseMissionBodyFields(rest);
  const { name, instruction, context, localDirs, references, skills, suggestedToolsets, goals, modelId, provider, profileName, missionTimeMinutes, timeoutMinutes, schedule: scheduleVal, categoryId: categoryIdRaw, outputFormat, constraints } = f;

  if (!dispatchMode) {
    return badRequest("dispatchMode is required");
  }

  const categoryId = parseCategoryIdOrError(categoryIdRaw);
  if (categoryId instanceof NextResponse) return categoryId;

  if (
    instruction !== undefined &&
    (typeof instruction !== "string" || !instruction.trim())
  ) {
    return badRequest("instruction cannot be empty");
  }

  const result = await promoteMission({
    missionId: missionIdFinal,
    dispatchMode,
    schedule: scheduleVal,
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
    categoryId,
    outputFormat,
    constraints,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.error,
        cronPushError: result.cronPushError,
        data: result.mission ? { mission: result.mission } : undefined,
      },
      { status: result.status },
    );
  }

  appendAuditLine({ action: "mission.promote", resource: missionIdFinal, ok: true });
  return ok({ mission: result.mission });
}
