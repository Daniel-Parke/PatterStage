// ═══════════════════════════════════════════════════════════════
// session-title.ts — display title resolver for session records
// ═══════════════════════════════════════════════════════════════
// Pure and browser-safe: the sessions list page (client) and the
// /api/sessions/[id] route (server) both use it, so no Node-only APIs. The
// jobs.json loader lives in `session-title-server.ts` for that reason; the page
// passes a `null` map, server routes pass the loaded map for nicer names.

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
 * The job id from a Hermes cron session id (`cron_<job-uuid>_<YYYYMMDD>_<HHMMSS>`),
 * or null when the shape does not match.
 */
export function cronJobIdFromSessionId(sessionId: string): string | null {
  if (!sessionId.startsWith("cron_")) return null;
  const rest = sessionId.slice("cron_".length);
  const firstUnderscore = rest.indexOf("_");
  if (firstUnderscore <= 0) return null;
  return rest.slice(0, firstUnderscore);
}

/**
 * The job id and the segments after it, which session-sync formats into
 * "Cron: <name> — <date> <time>". Null without the `cron_` prefix or with
 * fewer than three segments.
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
 * @param cronJobs optional map of cron job id -> entry; without it, or with the
 *                 job absent, the first 8 chars of the embedded job id are used.
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
    // The dispatch pipeline normally sets the mission name as session.title.
    if (session.profileName) return `Mission: ${session.profileName}`;
    return `Mission ${idPrefix}`;
  }

  if (session.source === "api") {
    return `API: ${idPrefix}`;
  }

  return `Session ${idPrefix}`;
}

/**
 * For the session detail page: no messages, but the API note says the agent is
 * still running, so the page shows a refresh CTA instead of "No messages". The
 * note comes from `/api/sessions/[id]`'s no-output-yet sentinel branches.
 */
export function isSessionStillRunning(
  messageCount: number,
  note: string | null | undefined,
): boolean {
  if (messageCount > 0) return false;
  if (!note) return false;
  return /still running|in progress|mid-flight/i.test(note);
}
