// ═══════════════════════════════════════════════════════════════
// stats/agent-stats-repository.ts — the per-agent reads behind the
// Agents page performance strip and the Agent Experience level
//
// Every query that agent-stats.ts and agent-experience.ts used to
// prepare inline lives here, with its SQL, parameters and row shape
// unchanged. The functions deliberately do NOT swallow their errors:
// both callers already wrap these reads in try/catch blocks whose
// exact grouping is load-bearing (the agent_root read and the
// agent_profiles read share one catch, so a failure on the first
// must skip the second), and moving the swallow in here would change
// that grouping.
//
// It sits beside stats-repository.ts rather than inside it because
// stats-repository.ts imports getAgentPerformance from agent-stats.ts;
// folding these reads into that file would close the loop into an
// import cycle.
// ═══════════════════════════════════════════════════════════════

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

/** Total number of catalogued skills (the ceiling a profile's disabled list subtracts from). */
export function countSkills(): number | undefined {
  return (getDb().prepare("SELECT COUNT(*) AS v FROM skills").get() as { v: number } | undefined)?.v;
}

/** The profile-shaped columns of a row in agent_root or agent_profiles. */
export interface AgentProfileStatsRow {
  display_name: string;
  personality: string;
  disabled_skills: string;
  platform_toolsets: string;
}

/** The single default-agent row (id = 1), or undefined when the table is empty. */
export function readAgentRootStatsRow(): AgentProfileStatsRow | undefined {
  return getDb()
    .prepare("SELECT display_name, personality, disabled_skills, platform_toolsets FROM agent_root WHERE id = 1")
    .get() as AgentProfileStatsRow | undefined;
}

/** Every named profile, with the columns the performance strip needs. */
export function readAgentProfileStatsRows(): Array<AgentProfileStatsRow & { slug: string }> {
  return getDb()
    .prepare("SELECT slug, display_name, personality, disabled_skills, platform_toolsets FROM agent_profiles")
    .all() as Array<AgentProfileStatsRow & { slug: string }>;
}

/** Distinct days on which the named profile completed a run. */
/**
 * Distinct days on which this agent completed a run.
 *
 * COALESCEs the profile exactly as `runsByProfile` does. A run against the root
 * agent stores `profile_name = NULL`, so a bare `profile_name = ?` matched none
 * of them: the SAME run earned XP through the coalescing aggregate and
 * contributed no active day here, and two numbers on one dashboard panel
 * disagreed about whether it had happened (T-0081, RC-C).
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
