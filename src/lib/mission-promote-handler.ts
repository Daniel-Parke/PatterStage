// ═══════════════════════════════════════════════════════════════
// mission-promote-handler.ts — promote draft/queued missions (shared API logic)
// ═══════════════════════════════════════════════════════════════

import {
  getMission,
  updateMission,
} from "@/lib/mission-repository";
import { buildMissionFieldPatch } from "@/lib/mission-field-updates";
import { dispatchMissionNow } from "@/lib/mission-dispatch";
import { runMissionQueueTick } from "@/lib/mission-queue-tick";
import { createSchedule } from "@/lib/schedules-repository";
import { parseSchedule, scheduleDisplayFromParsed } from "@/lib/schedule/parse-schedule";
import { computeNextRun } from "@/lib/schedule/next-run";
import { enrichedMission } from "@/lib/mission-response";
import { logApiError } from "@/lib/api-logger";
import { isMissionDraft, isMissionQueuedForRun } from "@/lib/mission-board";
import { parseDispatchMode } from "@/lib/dispatch-mode";
import type { Mission } from "@/lib/mission-types";

export interface PromoteMissionInput {
  missionId: string;
  dispatchMode: string;
  schedule?: string;
  name?: string;
  instruction?: string;
  context?: string;
  localDirs?: unknown;
  references?: string[];
  skills?: string[];
  suggestedToolsets?: string[];
  goals?: string[];
  modelId?: string;
  provider?: string;
  profileName?: string;
  missionTimeMinutes?: number;
  timeoutMinutes?: number;
  categoryId?: string | null;
  outputFormat?: string;
  constraints?: string;
}

export type PromoteMissionResult =
  | { ok: true; mission: Mission }
  | { ok: false; status: number; error: string; cronPushError?: string; mission?: Mission };

export async function promoteMission(
  input: PromoteMissionInput,
): Promise<PromoteMissionResult> {
  const existing = getMission(input.missionId);
  if (!existing) {
    return { ok: false, status: 404, error: "Mission not found" };
  }

  if (existing.status === "dispatched") {
    return {
      ok: false,
      status: 400,
      error: "Use update for running missions; promote applies to drafts and queued missions",
    };
  }

  if (existing.status === "successful" || existing.status === "failed") {
    return {
      ok: false,
      status: 400,
      error: "Use re-dispatch for completed missions",
    };
  }

  if (
    existing.status !== "queued" ||
    (!isMissionDraft(existing) && !isMissionQueuedForRun(existing))
  ) {
    return { ok: false, status: 400, error: "Mission cannot be promoted in its current state" };
  }

  const dispatchMode = input.dispatchMode;
  const { isSaveMode, isQueueMode, isCronMode, isNowMode, valid } = parseDispatchMode(dispatchMode, input.schedule);

  if (!valid) {
    return { ok: false, status: 400, error: "Invalid dispatchMode for promote" };
  }

  if (isCronMode && !input.schedule?.trim()) {
    return { ok: false, status: 400, error: "schedule is required for cron promote" };
  }

  const { updates } = buildMissionFieldPatch(
    existing,
    {
      name: input.name,
      instruction: input.instruction,
      context: input.context,
      localDirs: input.localDirs,
      references: input.references,
      skills: input.skills,
      suggestedToolsets: input.suggestedToolsets,
      goals: input.goals,
      modelId: input.modelId,
      provider: input.provider,
      profileName: input.profileName,
      missionTimeMinutes: input.missionTimeMinutes,
      timeoutMinutes: input.timeoutMinutes,
      schedule: input.schedule,
      categoryId: input.categoryId,
      outputFormat: input.outputFormat,
      constraints: input.constraints,
    },
    input.categoryId,
  );

  if (isSaveMode) {
    updates.queuedForRun = false;
  } else if (isQueueMode) {
    updates.queuedForRun = true;
  }

  const mission = updateMission(input.missionId, updates);
  if (!mission) {
    return { ok: false, status: 404, error: "Mission not found" };
  }

  if (isCronMode) {
    // Recurring promote → a PatterStage `schedules` row (the scheduler fires it);
    // no legacy cron_jobs / jobs.json. Mirrors the dispatch cron branch.
    const parsed = parseSchedule(input.schedule!);
    if (parsed.kind === "invalid") {
      return { ok: false, status: 400, error: `Unrecognized schedule: ${input.schedule}` };
    }
    try {
      const current = getMission(input.missionId)!;
      const next = computeNextRun(input.schedule!, new Date());
      const schedule = createSchedule({
        missionId: input.missionId,
        name: current.name,
        schedule: input.schedule!,
        scheduleDisplay: scheduleDisplayFromParsed(parsed, input.schedule!),
        enabled: true,
        profileName: input.profileName ?? current.profileName ?? null,
        nextRunAt: next ? next.toISOString() : null,
      });

      // Best-effort first run, linked to the schedule.
      try {
        await dispatchMissionNow(input.missionId, {
          profileName: input.profileName,
          modelId: input.modelId,
          provider: input.provider,
          scheduleId: schedule.id,
        });
      } catch (err) {
        logApiError("promoteMission", "schedule first-run", err);
      }
    } catch (err) {
      logApiError("promoteMission", "schedule promote", err);
      updateMission(input.missionId, { status: "failed" });
      return { ok: false, status: 500, error: "Failed to schedule mission" };
    }

    return { ok: true, mission: enrichedMission(input.missionId)! };
  }

  if (isNowMode) {
    const result = await dispatchMissionNow(input.missionId, {
      profileName: input.profileName,
      modelId: input.modelId,
      provider: input.provider,
    });
    if (!result.ok) {
      return {
        ok: false,
        status: 500,
        error: "Failed to dispatch mission",
        mission: enrichedMission(input.missionId)!,
      };
    }
    return { ok: true, mission: enrichedMission(input.missionId)! };
  }

  if (isQueueMode) {
    void runMissionQueueTick();
  }

  return { ok: true, mission: enrichedMission(input.missionId)! };
}
