// ═══════════════════════════════════════════════════════════════
// session-title.ts — Display title resolver for session records
// ═══════════════════════════════════════════════════════════════
// Pure, side-effect-free, browser-safe helper. Used by both the
// sessions list page (client component) and the /api/sessions/[id]
// route (server). Keeping the title resolver free of Node-only APIs
// means it can be bundled into the browser without a 'fs' stub.
//
// Fallback chain (newest first wins):
//   1. session.title
//   2. for source=cron: "Cron: <cron job name from jobs.json>" (or job id)
//      — requires the caller to pass `cronJobs`; otherwise falls back
//      to the embedded job id from the session id itself.
//   3. for source=mission: "Mission: <mission name>" (or id)
//   4. for source=api: "API: <first 8 chars of id>"
//   5. final fallback: "Session <first 8 chars of id>"
//
// The server-only jobs.json loader lives in `session-title-server.ts`
// to keep this module browser-safe. The page passes a `null` map (uses
// embedded id); server routes pass the loaded map for nicer names.

export interface TitleInput {
  id: string;
  source: string;
  title: string | null;
  missionId?: string | null;
  profileName?: string | null;
}

export interface CronJobEntry {
  id: string;
  name?: string | null;
}

/**
 * Best-effort extraction of a cron job id from a session id.
 *
 * Hermes cron session ids look like `cron_<job-uuid>_<YYYYMMDD>_<HHMMSS>`.
 * The job uuid is the prefix before the first underscore after `cron_`.
 * Returns null if the id doesn't match the expected shape.
 */
export function cronJobIdFromSessionId(sessionId: string): string | null {
  if (!sessionId.startsWith("cron_")) return null;
  const rest = sessionId.slice("cron_".length);
  const firstUnderscore = rest.indexOf("_");
  if (firstUnderscore <= 0) return null;
  return rest.slice(0, firstUnderscore);
}

/**
 * Parse the segments of a cron session id into structured parts.
 *
 * Hermes cron session ids look like `cron_<job-uuid>_<YYYYMMDD>_<HHMMSS>`.
 * The legacy sync code in session-repository.ts used the same shape
 * to format titles ("Cron: <name> — <date> <time>"), so this helper
 * returns the segments in a structure that maps 1:1 onto that use.
 *
 * Returns null when the id doesn't match the expected shape (no
 * `cron_` prefix, or fewer than 3 underscore-separated segments).
 */
export function parseCronSessionId(sessionId: string):
  | { jobId: string; rest: string[] }
  | null {
  const jobId = cronJobIdFromSessionId(sessionId);
  if (!jobId) return null;
  const rest = sessionId.slice("cron_".length + jobId.length + 1).split("_");
  if (rest.length < 2) return null; // need at least date + time
  return { jobId, rest };
}

/**
 * Resolve a display title for a session record.
 *
 * @param session  the session record (or a subset of its fields)
 * @param cronJobs optional pre-loaded map of cron job id -> entry.
 *                 When omitted or the job isn't in the map, falls back
 *                 to the first 8 chars of the embedded job id.
 */
export function formatSessionTitle(
  session: TitleInput,
  cronJobs?: Map<string, CronJobEntry> | null,
): string {
  if (session.title) return session.title;

  const idPrefix = session.id.slice(0, 8);

  if (session.source === "cron") {
    const jobId = cronJobIdFromSessionId(session.id);
    if (jobId) {
      const job = cronJobs?.get(jobId);
      if (job?.name) return `Cron: ${job.name}`;
      return `Cron: ${jobId.slice(0, 8)}`;
    }
    return `Session ${idPrefix}`;
  }

  if (session.source === "mission") {
    // Mission name is normally set by the dispatch pipeline as session.title,
    // but if it isn't, fall back to a short id.
    if (session.profileName) return `Mission: ${session.profileName}`;
    return `Mission ${idPrefix}`;
  }

  if (session.source === "api") {
    return `API: ${idPrefix}`;
  }

  return `Session ${idPrefix}`;
}

/**
 * Pure helper for the session detail page: detect when a session has no
 * messages but the API note suggests the agent is still running, so the
 * page can show a refresh CTA instead of "No messages in this session".
 *
 * The note comes from `/api/sessions/[id]`'s no-output-yet sentinel
 * branches (mission-spawned, cron-spawned). Returns false when the
 * note is missing, empty, or doesn't match the running pattern.
 */
export function isSessionStillRunning(
  messageCount: number,
  note: string | null | undefined,
): boolean {
  if (messageCount > 0) return false;
  if (!note) return false;
  return /still running|in progress|mid-flight/i.test(note);
}
