// ═══════════════════════════════════════════════════════════════
// session-mission-links.ts: resolving a session's parent mission
//
// Split out of session-sync.ts. One responsibility: answer "which
// PatterStage mission does this agent session belong to?", in the two
// shapes the callers need.
//
//   - bulk (`buildMissionIdByJobId`, `buildValidMissionIdSet`), built
//     once per sync tick and used to tag every row in the batch.
//   - single (`lookupMissionIdForCronSession`), used by the
//     per-session detail API so a transcript page can render an
//     "Open Mission" link without paying for the bulk build.
//
// Both shapes walk the SAME join path, and that is the reason they
// live together rather than one beside each caller: if the path ever
// changes, one file changes.
//
//   Hermes job id -> cron_jobs.external_job_id
//                 -> cron_jobs.id
//                 -> missions.cron_job_id (FK)
//                 -> missions.id
//
// Every function swallows its errors and degrades to "no link". A
// missing mission link costs a UI affordance; a throw here would take
// down a sync tick or a transcript page. The swallows stay HERE: the
// three statements now live in ./session-sync-repository, which throws,
// so each caller keeps deciding what "no link" means for itself.
// ═══════════════════════════════════════════════════════════════

import {
  readAllMissionIds,
  readMissionIdForExternalJobId,
  readMissionIdsByExternalJobId,
} from "./session-sync-repository";
import { cronJobIdFromSessionId } from "./session-title";

/**
 * Build a set of all mission IDs from PatterStage's missions table.
 * Includes soft-deleted missions — the FK constraint only checks id existence,
 * not deleted_at. Used to filter session mission_ids so we never insert
 * a mission_id that would violate the FK.
 */
export function buildValidMissionIdSet(): Set<string> {
  try {
    const rows = readAllMissionIds();
    return new Set(rows.map((r) => r.id));
  } catch {
    return new Set();
  }
}

/**
 * Build a map of Hermes job ID -> PatterStage mission UUID.
 *
 * Correct join path:
 *   Hermes job ID (e.g. "9514116b5b0d")
 *     -> cron_jobs.external_job_id = job ID
 *     -> cron_jobs.id = cron_job UUID
 *     -> missions.cron_job_id = cron_jobs.id (FK to cron_jobs)
 *     -> missions.id = mission UUID
 */
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

/**
 * Look up the PatterStage mission id for a single Hermes cron job id.
 *
 * Used by the per-session detail API (`/api/sessions/[id]`) to surface
 * an "Open Mission" link on the transcript page for cron-spawned sessions
 * without paying for a full sync build of the job-id → mission-id map.
 *
 * Companion to `buildMissionIdByJobId` (bulk version used during the
 * 15s sessions sync). Both use the same join path:
 *   cron_jobs.external_job_id → cron_jobs.id → missions.cron_job_id → missions.id
 *
 * Returns null when the job id is missing/empty, when the DB is
 * unavailable, or when no mission has been registered for the job
 * (the detail page just doesn't render a Mission link in that case).
 */
function lookupMissionIdForHermesJob(externalJobId: string): string | null {
  if (!externalJobId) return null;
  try {
    const row = readMissionIdForExternalJobId(externalJobId);
    return row?.mission_id ?? null;
  } catch {
    // DB unavailable or schema differs — non-fatal
    return null;
  }
}

/**
 * Best-effort lookup of the PatterStage mission id for a cron-spawned
 * session. The session id has the form `cron_<job-uuid>_<date>_<time>`;
 * the job uuid resolves to cron_jobs.id, which resolves to missions.id
 * via the missions.cron_job_id FK. Returns null for non-cron sessions
 * or when no mission has been registered for the job.
 *
 * Used by the per-session detail API (`/api/sessions/[id]`) so the
 * transcript page can render an "Open Mission" link for cron-spawned
 * sessions without doing the bulk sync build (`buildMissionIdByJobId`).
 */
export function lookupMissionIdForCronSession(sessionId: string): string | null {
  const jobId = cronJobIdFromSessionId(sessionId);
  if (!jobId) return null;
  return lookupMissionIdForHermesJob(jobId);
}
