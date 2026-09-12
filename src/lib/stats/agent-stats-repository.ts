// stats/agent-stats-repository.ts — the per-agent reads behind the Agents
// page performance strip and the Agent Experience level.
//
// Errors are NOT swallowed here: both callers wrap these reads in try/catch
// whose grouping is load-bearing (the agent_root and agent_profiles reads
// share one catch, so a failure on the first must skip the second). Beside
// stats-repository.ts rather than inside it, which would close an import cycle
// through agent-stats.ts.

import { getDb } from "@/lib/db";

/** One run row, as the per-profile aggregation reads it. */
export interface RunProfileRow {
  profile_name: string | null;
  status: string;
  usage_json: string | null;
  submitted_at: string;
  completed_at: string | null;
}

/** Every run, with the columns the per-profile aggregate needs. */
export function readRunProfileRows(): RunProfileRow[] {
  return getDb()
    .prepare("SELECT profile_name, status, usage_json, submitted_at, completed_at FROM runs")
    .all() as RunProfileRow[];
}

/** Mission counts grouped by profile and status (live missions only). */
export function readMissionStatusCountsByProfile(): Array<{ p: string; status: string; c: number }> {
  return getDb()
    .prepare(
      "SELECT COALESCE(profile_name, profile_id, 'default') AS p, status, COUNT(*) c FROM missions WHERE deleted_at IS NULL GROUP BY p, status",
    )
    .all() as Array<{ p: string; status: string; c: number }>;
}

/**
 * The profile-shaped columns of agent_root or agent_profiles. `disabled_skills`
 * is deliberately absent: selecting a denylist nothing subtracts would invite
 * the skills-count arithmetic back.
 */
export interface AgentProfileStatsRow {
  display_name: string;
  personality: string;
  platform_toolsets: string;
}

/** The single default-agent row (id = 1), or undefined when the table is empty. */
export function readAgentRootStatsRow(): AgentProfileStatsRow | undefined {
  return getDb()
    .prepare("SELECT display_name, personality, platform_toolsets FROM agent_root WHERE id = 1")
    .get() as AgentProfileStatsRow | undefined;
}

/** Every named profile, with the columns the performance strip needs. */
export function readAgentProfileStatsRows(): Array<AgentProfileStatsRow & { slug: string }> {
  return getDb()
    .prepare("SELECT slug, display_name, personality, platform_toolsets FROM agent_profiles")
    .all() as Array<AgentProfileStatsRow & { slug: string }>;
}

/**
 * Distinct days on which this agent completed a run. COALESCEs the profile as
 * `runsByProfile` does: a root run stores `profile_name = NULL`, so a bare
 * equality matched none, and two numbers on one panel disagreed (T-0081, RC-C).
 */
export function countAgentActiveDays(slug: string): number | undefined {
  return (
    getDb()
      .prepare(
        "SELECT COUNT(DISTINCT date(completed_at)) AS v FROM runs " +
          "WHERE COALESCE(profile_name, 'default') = ? AND status = 'completed'",
      )
      .get(slug) as { v: number } | undefined
  )?.v;
}
