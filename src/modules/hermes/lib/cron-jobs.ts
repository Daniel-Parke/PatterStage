// ═══════════════════════════════════════════════════════════════
// session-title-server.ts — Server-only helpers for session titles
// ═══════════════════════════════════════════════════════════════
// Separated from session-title.ts so the browser bundle doesn't
// include node:fs. Use loadCronJobsMap() from server contexts only
// (API routes, server components, sync sources). Pass the returned
// Map into formatSessionTitle() from session-title.ts.

import { existsSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { getActiveHermesHome } from "./agent-runtime";
import type { CronJobEntry } from "@/lib/sessions/session-title";

let cachedCronJobs: Map<string, CronJobEntry> | null = null;
let cachedCronJobsMtimeMs = 0;
let cachedCronJobsPath: string | null = null;

/**
 * Load cron jobs from ~/.hermes/cron/jobs.json (synchronous, cached at module level).
 * Returns an empty map on missing file or parse error — never throws.
 */
export function loadCronJobsMap(): Map<string, CronJobEntry> {
  const cronDir = join(getActiveHermesHome(), "cron");
  const jobsPath = join(cronDir, "jobs.json");
  try {
    if (!existsSync(jobsPath)) {
      cachedCronJobs = new Map();
      cachedCronJobsPath = jobsPath;
      cachedCronJobsMtimeMs = 0;
      return cachedCronJobs;
    }
    const mtimeMs = statSync(jobsPath).mtimeMs;
    if (
      cachedCronJobs &&
      cachedCronJobsPath === jobsPath &&
      cachedCronJobsMtimeMs === mtimeMs
    ) {
      return cachedCronJobs;
    }
    const raw = readFileSync(jobsPath, "utf-8");
    const parsed = JSON.parse(raw) as { jobs?: CronJobEntry[] };
    const map = new Map<string, CronJobEntry>();
    for (const job of parsed.jobs ?? []) {
      if (job?.id) map.set(job.id, job);
    }
    cachedCronJobs = map;
    cachedCronJobsPath = jobsPath;
    cachedCronJobsMtimeMs = mtimeMs;
    return map;
  } catch {
    cachedCronJobs = new Map();
    cachedCronJobsPath = jobsPath;
    cachedCronJobsMtimeMs = 0;
    return cachedCronJobs;
  }
}
