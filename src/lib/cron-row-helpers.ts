// ═══════════════════════════════════════════════════════════════
// cron-row-helpers.ts — Pure helpers for cron job row display
// ═══════════════════════════════════════════════════════════════
//
// The dashboard's Cron Jobs panel renders a one-line status caption
// for each job. The caption is selected from a priority-ordered set
// of cases (executing → last-finished → next-run → "Active · Ran
// X" → Queued) and the colour is derived from the same conditional
// ladder. Extracted out of the JSX nested-ternary so the priority
// rules and colour mapping can be unit-tested in isolation, and so
// the JSX reads as `<span className={...}>{caption}</span>`.
//
// The pure formatting helpers (formatLastRunAgo, formatNextRunIn)
// re-implement the "5m ago" / "Next 5m" formatting here rather than
// reusing timeAgo/timeUntil from @/lib/utils, because those use
// Date.now() internally and we want the output to be deterministic
// when the caller passes a `now` for testing or rendering.

import { titleCase } from "@/lib/utils";

/**
 * Minimal cron-job shape used by the dashboard caption. The full
 * Hermes job type has many more fields; we only narrow on what the
 * caption actually reads.
 */
export interface CronJobRowShape {
  state?: string | null;
  lastStatus?: string | null;
  lastRun?: string | null;
  nextRun?: string | null;
}

/** The caption + colour pair returned by `computeCronJobRowCaption`. */
export interface CronJobRowCaption {
  text: string;
  /** Tailwind class fragment, e.g. "text-neon-green". */
  colorClass: string;
}

/**
 * Format `iso` as a "Xm ago"-style relative duration, measured
 * against `now`. Mirrors the public `timeAgo()` format from
 * @/lib/utils but uses an explicit `now` so the output is
 * deterministic in tests.
 */
function formatLastRunAgo(iso: string, now: number): string {
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return "never";
  const diff = now - ts;
  if (diff < 0) return "never";
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/**
 * Format `iso` as a "Next X"-style relative duration, measured
 * against `now`. Mirrors the public `timeUntil()` format from
 * @/lib/utils but uses an explicit `now`.
 */
function formatNextRunIn(iso: string, now: number): string {
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return "—";
  const diff = ts - now;
  if (diff <= 0) return "overdue";
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return "< 1m";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remainderMins = mins % 60;
  if (remainderMins === 0) return `${hours}h`;
  return `${hours}h ${remainderMins}m`;
}

/**
 * Derive the dashboard row caption for a single cron job.
 *
 * Priority order (matches the previous inline ternary):
 *  1. `state === "running"`            → "Executing..."      (green)
 *  2. `lastRun && !nextRun`            → "Ok 5m ago"         (green if ok, red otherwise)
 *  3. `nextRun && nextRun > now`       → "Next 5m"           (green)
 *  4. `lastRun`                        → "Active · Ran 5m"   (green)
 *  5. otherwise                        → "Queued"            (orange)
 */
export function computeCronJobRowCaption(
  job: CronJobRowShape,
  now: number,
): CronJobRowCaption {
  if (job.state === "running") {
    return { text: "Executing...", colorClass: "text-neon-green" };
  }
  if (job.lastRun && !job.nextRun) {
    const text = `${titleCase(job.lastStatus || "Ok")} ${formatLastRunAgo(job.lastRun, now)}`;
    // Color matches the original JSX ternary:
    //   green  → lastStatus === "ok" OR lastStatus missing
    //   red    → lastStatus exists AND !== "ok"
    // (Note: when lastStatus is missing, the text shows "Ok 5m ago"
    //  because of the `|| "Ok"` fallback — the green colour was a
    //  deliberate "best-case assumption" in the original code.)
    const colorClass = job.lastStatus && job.lastStatus !== "ok"
      ? "text-red-400"
      : "text-neon-green";
    return { text, colorClass };
  }
  if (job.nextRun && new Date(job.nextRun).getTime() > now) {
    return { text: "Next " + formatNextRunIn(job.nextRun, now), colorClass: "text-neon-green" };
  }
  if (job.lastRun) {
    return { text: `Active · Ran ${formatLastRunAgo(job.lastRun, now)}`, colorClass: "text-neon-green" };
  }
  return { text: "Queued", colorClass: "text-neon-orange" };
}
