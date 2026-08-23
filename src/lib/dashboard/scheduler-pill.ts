// ═══════════════════════════════════════════════════════════════
// dashboard/scheduler-pill.ts: the scheduler heartbeat, in three strings
//
// The background scheduler is the loop that fires due schedules and
// reconciles dispatched runs. When it stops, nothing in the console
// changes: schedules quietly do not fire, and a dispatched mission stays
// "running" forever. The only evidence was a console.log on a server
// terminal the operator does not have open.
//
// The heartbeat is already in the database (see
// orchestration/scheduler/health.ts). This turns it into the label, value
// and subtitle of one dashboard pill, as a pure function so the wording
// is testable without rendering a page.
// ═══════════════════════════════════════════════════════════════

import type { SchedulerHealth } from "@/lib/orchestration/scheduler/health";
import type { AccentColor } from "@/types/console";

export interface SchedulerPillView {
  /** Headline: what the scheduler is doing. */
  value: string;
  /** Secondary line: when it last ticked, and which process owns the lease. */
  subtitle: string;
  color: AccentColor;
}

/** Seconds-first, because a healthy tick is 15s and "just now" hides a stall. */
function tickAge(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 90) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 90) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
}

/**
 * Describe the scheduler's heartbeat for the dashboard stat row.
 *
 * Three states, and the difference between them is what an operator
 * needs: never started (nothing has ever held the lease), stalled (it
 * held the lease and stopped refreshing it), ticking.
 */
export function describeSchedulerHealth(
  health: SchedulerHealth | undefined,
  now: number,
): SchedulerPillView {
  const owner = health?.ownerPid != null ? `pid ${health.ownerPid}` : "no owner";

  if (!health || !health.lastTickAt) {
    return {
      value: "Never started",
      subtitle: "no heartbeat recorded, schedules will not fire",
      color: "pink",
    };
  }

  const beat = Date.parse(health.lastTickAt);
  if (!Number.isFinite(beat)) {
    return {
      value: "Unknown",
      subtitle: `unreadable heartbeat · ${owner}`,
      color: "orange",
    };
  }

  const age = tickAge(now - beat);
  if (health.stale) {
    return {
      value: "Stalled",
      subtitle: `last tick ${age} · ${owner}`,
      color: "pink",
    };
  }

  return {
    value: "Ticking",
    subtitle: `last tick ${age} · ${owner}`,
    color: "green",
  };
}
