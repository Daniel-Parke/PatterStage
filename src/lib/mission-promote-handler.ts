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
import { createCronJob, deleteCronJob, pushJobToHermes } from "@/lib/cron-repository";
import { syncMissionToCronJob } from "@/lib/mission-cron-sync";
import { enrichedMission } from "@/lib/mission-response";
import { agentBackend } from "@/lib/backends";
import { logApiError } from "@/lib/api-logger";
import { isMissionDraft, isMissionQueuedForRun } from "@/lib/mission-board";
import { cronSyncFailureResponse, cronSyncFailureBody } from "@/lib/cron-sync-failure";
import type { Mission } from "@/lib/agent-backend/types";

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
  const isSaveMode = dispatchMode === "save";
  const isQueueMode = dispatchMode === "queue";
  const isCronMode = dispatchMode === "cron" && input.schedule;
  const isNowMode = dispatchMode === "now";

  if (!isSaveMode && !isQueueMode && !isNowMode && !isCronMode) {
    return { ok: false, status: 400, error: "Invalid dispatchMode for promote" };
  }

  if (isCronMode && !input.schedule?.trim()) {
    return { ok: false, status: 400, error: "schedule is required for cron promote" };
  }

  const { shouldRebuildPrompt, prompt, updates } = buildMissionFieldPatch(
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

  const shouldSyncCron =
    mission.cronJobId &&
    (shouldRebuildPrompt ||
      input.schedule !== undefined ||
      input.profileName !== undefined ||
      input.modelId !== undefined ||
      input.provider !== undefined);

  if (shouldSyncCron) {
    await syncMissionToCronJob(input.missionId);
  }

  if (prompt !== undefined) {
    try {
      await agentBackend.syncMission(input.missionId, {
        prompt: getMission(input.missionId)!.prompt,
      });
    } catch (err) {
      logApiError("promoteMission", "syncMission disk", err);
    }
  }

  if (isCronMode) {
    try {
      const current = getMission(input.missionId)!;
      if (current.cronJobId) {
        await syncMissionToCronJob(input.missionId);
      } else {
        const cronJob = createCronJob({
          name: current.name,
          prompt: current.prompt,
          skills: current.skills ?? [],
          model: current.modelId ?? undefined,
          provider: current.provider ?? undefined,
          schedule: input.schedule!,
          repeat: { times: null },
          enabled: true,
          state: "scheduled",
          deliver: "none",
          profile_name: current.profileName ?? "default",
          source: "ch",
        });
        updateMission(input.missionId, { cronJobId: cronJob.id, schedule: input.schedule });
        const pushResult = await pushJobToHermes(cronJob.id);
        if (!pushResult.ok) {
          deleteCronJob(cronJob.id);
          updateMission(input.missionId, { cronJobId: null, status: "failed" });
          // Log via the same helper used by cron/route.ts and the missions
          // POST site so the console output (and body shape) is identical.
          // The body fields below are the same strings the helper builds;
          // we destructure it via `cronSyncFailureBody` so a future change
          // to the wire contract lands in one place.
          cronSyncFailureResponse("promoteMission", pushResult);
          return {
            ok: false,
            status: 502,
            ...cronSyncFailureBody(pushResult),
            mission: enrichedMission(input.missionId)!,
          };
        }
      }

      await dispatchMissionNow(input.missionId, {
        profileName: input.profileName,
        modelId: input.modelId,
        provider: input.provider,
      });
    } catch (err) {
      logApiError("promoteMission", "cron promote", err);
      updateMission(input.missionId, { status: "failed" });
      return { ok: false, status: 500, error: "Failed to promote mission to cron" };
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
