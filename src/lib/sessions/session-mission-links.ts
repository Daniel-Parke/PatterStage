// session-mission-links.ts: which PatterStage mission an agent session belongs
// to, in two shapes: bulk (`buildMissionIdByJobId`, `buildValidMissionIdSet`),
// built once per sync tick, and single (`lookupMissionIdForCronSession`), for
// the detail API's "Open Mission" link. Both walk the same join path, so they
// live together and change together:
//   Hermes job id -> cron_jobs.external_job_id -> cron_jobs.id
//                 -> missions.cron_job_id (FK) -> missions.id
// Every function swallows and degrades to "no link": a throw would take down a
// sync tick or a transcript page for the sake of a UI affordance. The
// statements are in ./session-sync-repository, which throws; the swallows stay
// here so each caller decides what "no link" means for itself.

import {
  readAllMissionIds,
  readMissionIdForExternalJobId,
  readMissionIdsByExternalJobId,
} from "./session-sync-repository";
import { cronJobIdFromSessionId } from "./session-title";

/**
 * Every mission id, soft-deleted included: the FK checks existence, not
 * deleted_at. Filters session mission_ids so no insert violates the FK.
 */
export function buildValidMissionIdSet(): Set<string> {
  try {
    const rows = readAllMissionIds();
    return new Set(rows.map((r) => r.id));
  } catch {
    return new Set();
  }
}

/** Hermes job ID -> PatterStage mission UUID for every registered job (join path in the header). */
export function buildMissionIdByJobId(): Map<string, string> {
  const missionIdByJobId = new Map<string, string>();
  try {
    const rows = readMissionIdsByExternalJobId();
    for (const row of rows) {
      missionIdByJobId.set(row.external_job_id, row.mission_id);
    }
  } catch {
    // table structure may differ — non-fatal
  }
  return missionIdByJobId;
}

/** Null for an empty job id, an unavailable DB, or no mission registered for the
 * job; the detail page then renders no Mission link. */
function lookupMissionIdForHermesJob(externalJobId: string): string | null {
  if (!externalJobId) return null;
  try {
    const row = readMissionIdForExternalJobId(externalJobId);
    return row?.mission_id ?? null;
  } catch {
    return null;
  }
}

/**
 * Best-effort mission id for a cron-spawned session (`cron_<job-uuid>_<date>_<time>`);
 * null for non-cron sessions or an unregistered job.
 */
export function lookupMissionIdForCronSession(sessionId: string): string | null {
  const jobId = cronJobIdFromSessionId(sessionId);
  if (!jobId) return null;
  return lookupMissionIdForHermesJob(jobId);
}
