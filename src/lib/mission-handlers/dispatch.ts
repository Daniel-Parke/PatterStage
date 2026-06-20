// ═══════════════════════════════════════════════════════════════
// mission-handlers/dispatch.ts — POST /api/missions { action: "dispatch" }
// ═══════════════════════════════════════════════════════════════
//
// Creates a mission from the composer payload and runs it according to
// the dispatch mode: save (draft), queue (queued-for-run), cron
// (recurring on the PatterStage scheduler), or immediate. Extracted
// from the /api/missions route god-file.

import { NextResponse } from "next/server";

import {
  createMission,
  updateMission,
  buildMissionPrompt,
} from "@/lib/mission-repository";
import { normalizeLocalDirsInput } from "@/lib/local-dir-entry";
import { logApiError } from "@/lib/api-logger";
import { badRequest, serverError } from "@/lib/api-response";
import { appendAuditLine } from "@/lib/audit-log";
import { listProfiles } from "@/lib/profiles-repository";
import { createSchedule } from "@/lib/schedules-repository";
import { parseSchedule, scheduleDisplayFromParsed } from "@/lib/schedule/parse-schedule";
import { computeNextRun } from "@/lib/schedule/next-run";
import { dispatchMissionNow } from "@/lib/mission-dispatch";
import { parseMissionBodyFields } from "@/lib/mission-body";
import { runMissionQueueTick } from "@/lib/mission-queue-tick";
import { missionResponse } from "@/lib/mission-response";
import { parseDispatchMode } from "@/lib/dispatch-mode";

import { parseCategoryIdOrError } from "./shared";

export async function handleDispatchMission(
  body: Record<string, unknown>,
): Promise<NextResponse> {
  const { name, instruction, context, localDirs, references, skills, suggestedToolsets, goals, modelId, provider, profileName, missionTimeMinutes, timeoutMinutes, categoryId: categoryIdRaw, outputFormat, constraints } =
    parseMissionBodyFields(body);
  const { dispatchMode, schedule: scheduleVal, profileId } = body as {
    dispatchMode?: string;
    schedule?: string;
    profileId?: string;
    [key: string]: unknown;
  };

  const categoryId = parseCategoryIdOrError(categoryIdRaw);
  if (categoryId instanceof NextResponse) return categoryId;

  if (!instruction || typeof instruction !== "string" || !instruction.trim()) {
    return badRequest("instruction is required");
  }

  const dirsNorm = normalizeLocalDirsInput(localDirs);

  const prompt = buildMissionPrompt({
    instruction: instruction.trim(),
    localDirs: dirsNorm,
    references: references ?? [],
    skills: skills ?? [],
    toolsets: suggestedToolsets ?? [],
    goals: goals ?? [],
    context: context ?? "",
    missionTimeMinutes: missionTimeMinutes ?? undefined,
    timeoutMinutes: timeoutMinutes ?? undefined,
    outputFormat: outputFormat ?? "",
    constraints: constraints ?? "",
  });

  // Resolve profile slug from PatterStage registry (matches Hermes --profile <slug>).
  let resolvedProfileId: string | undefined;
  const profileKey = profileName ?? profileId;
  if (profileKey) {
    if (profileKey === "default") {
      resolvedProfileId = "default";
    } else {
      try {
        const profiles = listProfiles();
        const match = profiles.find(
          (p) =>
            p.slug === profileKey ||
            p.displayName === profileKey,
        );
        resolvedProfileId = match?.slug ?? profileKey;
      } catch {
        resolvedProfileId = profileKey;
      }
    }
  }

  const mission = createMission({
    name: (name as string)?.trim() || "Untitled Mission",
    prompt,
    profileId: resolvedProfileId ?? profileId,
    localDirs: dirsNorm,
    references: references ?? [],
    skills: skills ?? [],
    suggestedToolsets: suggestedToolsets ?? [],
    goals: goals ?? [],
    modelId: modelId ?? undefined,
    provider: provider ?? undefined,
    profileName: profileName ?? undefined,
    missionTimeMinutes,
    timeoutMinutes,
    schedule: scheduleVal,
    categoryId: categoryId ?? null,
    outputFormat: outputFormat?.trim() || undefined,
    constraints: constraints?.trim() || undefined,
  });

  const { isSaveMode, isQueueMode, isCronMode } = parseDispatchMode(dispatchMode, scheduleVal);

  if (isSaveMode) {
    updateMission(mission.id, { queuedForRun: false });
  } else if (isQueueMode) {
    updateMission(mission.id, { queuedForRun: true });
  }

  if (isCronMode) {
    // ── Recurring mission on the PatterStage scheduler ──
    // PatterStage owns the timer: a `schedules` row (mission_id FK) is the
    // source of truth and the scheduler tick (orchestration/scheduler)
    // dispatches each occurrence via the runtime. There is NO Hermes
    // jobs.json bridge. The first run is kicked off immediately
    // (best-effort) so the user sees activity without waiting for the next
    // tick — the schedule is durable regardless of that run's outcome.
    const parsedSchedule = parseSchedule(scheduleVal!);
    if (parsedSchedule.kind === "invalid") {
      return badRequest(`Unrecognized schedule: ${scheduleVal}`);
    }

    try {
      const next = computeNextRun(scheduleVal!, new Date());
      const schedule = createSchedule({
        missionId: mission.id,
        name: mission.name,
        schedule: scheduleVal!,
        scheduleDisplay: scheduleDisplayFromParsed(parsedSchedule, scheduleVal!),
        enabled: true,
        profileName: profileName ?? mission.profileName ?? null,
        nextRunAt: next ? next.toISOString() : null,
      });

      // Immediate first run — best-effort (the schedule fires on the next
      // tick even if this run fails, e.g. the backend is momentarily down).
      // Pass scheduleId so this first run is linked to its schedule (the
      // run row's schedule_id), matching scheduler-fired runs.
      try {
        await dispatchMissionNow(mission.id, { profileName, modelId, provider, scheduleId: schedule.id });
      } catch (err) {
        logApiError("POST /api/missions", "schedule first-run", err);
      }

      appendAuditLine({ action: "mission.schedule_dispatch", resource: mission.id, ok: true });
      return missionResponse(mission.id, 201);
    } catch (err) {
      logApiError("POST /api/missions", "schedule dispatch", err);
      updateMission(mission.id, { status: "failed" });
      appendAuditLine({ action: "mission.schedule_dispatch", resource: mission.id, ok: false });
      return serverError("Failed to schedule mission");
    }
  }

  if (!isSaveMode && !isQueueMode) {
    // See JSDoc above the cron-mode branch for the typing rationale —
    // `DispatchMissionNowOverrides` accepts `string | undefined`
    // directly, so no `as` casts are needed on the body fields.
    await dispatchMissionNow(mission.id, { profileName, modelId, provider });
  } else if (isQueueMode) {
    void runMissionQueueTick();
  }

  appendAuditLine({ action: "mission.dispatch", resource: mission.id, ok: true });
  return missionResponse(mission.id, 201);
}
