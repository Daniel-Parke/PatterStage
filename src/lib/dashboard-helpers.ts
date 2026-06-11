// ═══════════════════════════════════════════════════════════════
// dashboard-helpers.ts — Pure helpers for the Dashboard page
// ═══════════════════════════════════════════════════════════════
//
// The Dashboard (src/app/page.tsx) embeds 2 tiny pure helpers plus
// 1 tiny presentational component that the page uses inline:
//
//   - `composeTemplateUrl(templateId)`  — builds the URL the page
//     links to when a template pill is clicked in the Mission
//     Dispatch strip. Pure string formatting.
//
//   - `withCronJobSchedule(monitor, jobId, newSchedule)` — returns
//     a new `MonitorData` with the given cron job's `schedule`
//     field replaced. The page uses this for the optimistic-update
//     half of `handleCronScheduleChange` (it shows the new schedule
//     immediately while the PUT round-trips).
//
// Both helpers are byte-equivalent to the page-inlined versions
// and live here so they're unit-testable in isolation (the
// optimistic-update shape is easy to break — the page previously
// mutated the monitor object in-place, which broke React's
// reference-equality checks downstream).
//
// `MonitorData` is imported from `@/types/hermes` to keep the helper
// type-safe without a circular dep.

import type { MonitorData } from "@/types/hermes";

/** Build the missions page URL that opens the compose form prefilled with this template. */
export function composeTemplateUrl(templateId: string): string {
  return `/orchestration/missions?template=${templateId}&compose=1`;
}

/**
 * Return a new monitor with the given cron job's `schedule` field
 * set to `newSchedule`. Used by the dashboard's "update cron
 * schedule" handler to apply the change optimistically before the
 * API call round-trips. The original `monitor` is returned when it
 * is null (defensive — the page already guards against this case
 * via a showToast, but the helper stays safe to call on stale state).
 *
 * The optional `scheduleDisplay` parameter is the human-readable label
 * that the canonical form maps to (e.g. a 30-minute cron expression
 * maps to "every 30m"). When provided, the helper updates both
 * fields on the matching job so the optimistic state matches what
 * the server will return after the next /api/monitor poll. When
 * omitted, the existing `schedule_display` is preserved.
 *
 * Pure function: never mutates the input. The caller passes the
 * current `data.monitor` and the helper returns a new `MonitorData`
 * object so the React reference-equality checks downstream see a
 * new monitor object only when the target job actually exists.
 */
export function withCronJobSchedule(
  monitor: MonitorData | null,
  jobId: string,
  newSchedule: string,
  scheduleDisplay?: string | null,
): MonitorData | null {
  if (!monitor) return monitor;
  return {
    ...monitor,
    cron: {
      ...monitor.cron,
      jobs: monitor.cron.jobs.map((job) =>
        job.id === jobId
          ? {
              ...job,
              schedule: newSchedule,
              ...(scheduleDisplay !== undefined
                ? { schedule_display: scheduleDisplay }
                : {}),
            }
          : job,
      ),
    },
  };
}
