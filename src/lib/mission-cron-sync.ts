// ═══════════════════════════════════════════════════════════════
// mission-cron-sync.ts — Keep linked cron_jobs in sync with missions
// ═══════════════════════════════════════════════════════════════

import { getMission, updateMission } from "@/lib/mission-repository";
import {
  deleteCronJob,
  getCronJob,
  pushJobToHermes,
  updateCronJob,
} from "@/lib/cron-repository";
import { removeJobFromHermes } from "@/lib/cron/hermes-sync";
import { logApiError } from "@/lib/api-logger";
import { inTransaction } from "@/lib/db";
import type { Mission } from "@/lib/mission-types";

export interface MissionCronJobBrief {
  id: string;
  state: string;
  enabled: boolean;
  schedule: string;
  lastRun?: string;
  lastStatus?: string;
}

export function cronJobToBrief(
  job: NonNullable<ReturnType<typeof getCronJob>>,
): MissionCronJobBrief {
  return {
    id: job.id,
    state: job.state,
    enabled: job.enabled,
    schedule: job.schedule_display,
    lastRun: job.last_run_at ?? undefined,
    lastStatus: job.last_status ?? undefined,
  };
}

export function enrichMissionCron(
  mission: Mission,
): Mission & { cronJob?: MissionCronJobBrief } {
  if (!mission.cronJobId) return mission;
  const job = getCronJob(mission.cronJobId);
  if (!job) return mission;
  return { ...mission, cronJob: cronJobToBrief(job) };
}

export async function syncMissionToCronJob(missionId: string): Promise<boolean> {
  const mission = getMission(missionId);
  if (!mission?.cronJobId) return false;
  const job = getCronJob(mission.cronJobId);
  if (!job) return false;

  try {
    updateCronJob(mission.cronJobId, {
      name: mission.name,
      prompt: mission.prompt,
      skills: mission.skills ?? [],
      model: mission.modelId ?? undefined,
      provider: mission.provider ?? undefined,
      schedule: mission.schedule ?? job.schedule_display,
      profile_name: mission.profileName ?? job.profile_name,
      workdir: mission.localDirs?.[0]?.path ?? null,
    });
    const push = await pushJobToHermes(mission.cronJobId);
    if (!push.ok) {
      logApiError("syncMissionToCronJob", missionId, new Error(push.error ?? "push failed"));
      return false;
    }
    return true;
  } catch (err) {
    logApiError("syncMissionToCronJob", missionId, err);
    return false;
  }
}

export async function pauseMissionCron(missionId: string): Promise<boolean> {
  const mission = getMission(missionId);
  if (!mission?.cronJobId) return false;
  try {
    updateCronJob(mission.cronJobId, { enabled: false, state: "paused" });
    await pushJobToHermes(mission.cronJobId);
    return true;
  } catch (err) {
    logApiError("pauseMissionCron", missionId, err);
    return false;
  }
}

export async function deleteMissionCron(missionId: string): Promise<boolean> {
  const mission = getMission(missionId);
  if (!mission?.cronJobId) return true;
  const cronJobId: string = (mission as { cronJobId: string }).cronJobId;
  const job = getCronJob(cronJobId);

  try {
    await inTransaction(() => {
      if (job?.hermes_job_id) {
        // Fire-and-forget Hermes removal — non-critical, best-effort
        void removeJobFromHermes(job.hermes_job_id);
      }
      deleteCronJob(cronJobId);
      updateMission(missionId, { cronJobId: null });
    });
    return true;
  } catch (err) {
    logApiError("deleteMissionCron", missionId, err);
    return false;
  }
}
