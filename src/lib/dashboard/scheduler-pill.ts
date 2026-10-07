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
 * Five states, and the difference between them is what an operator needs:
 * never started (nothing has ever held the lease), unknown (the heartbeat is
 * unreadable), stalled (something held the lease and stopped refreshing it),
 * follower (the lease is live and held by ANOTHER process, so this one will
 * never dispatch), ticking.
 *
 * ORDER MATTERS. Stalled sits above Follower deliberately: a stale lease means
 * nothing is firing at all, whoever holds it, and that is the more urgent fact.
 * The docstring said "three states" for two states longer than it was true,
 * which is its own small lesson about counts in prose.
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

  // Live lease, held by someone else. Not a fault: schedules ARE firing, just
  // not here. Cyan rather than orange for exactly that reason, since an orange
  // pill beside a green one is what makes two healthy processes read as a
  // problem. The owner pid is printed in BOTH this and Ticking, so if a reading
  // ever alternates the value that changed is visible rather than mysterious.
  if (health.selfPid != null && health.ownerPid != null && health.ownerPid !== health.selfPid) {
    return {
      value: "Follower",
      subtitle: `last tick ${age} · owner ${owner} · this process (pid ${health.selfPid}) will not dispatch`,
      color: "cyan",
    };
  }

  return {
    value: "Ticking",
    subtitle: `last tick ${age} · ${owner}`,
    color: "green",
  };
}
