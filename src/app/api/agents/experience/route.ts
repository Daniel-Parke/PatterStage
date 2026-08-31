// ═══════════════════════════════════════════════════════════════
// GET /api/agents/experience — every agent's accumulated growth, ranked
//
// The Agent Experience Level was only ever reachable through the benchmark
// routes (leaderboard, agent-card, setups), even though nothing about it is
// benchmark-derived: agentExperienceForProfile reads completed runs, active
// days, enabled skills, attached toolsets and memory facts. When the benchmark
// subsystem was deleted this axis nearly went with it by accident.
//
// ADR-0004 keeps agent progression as the record of what an AGENT accumulated,
// and this is the surviving, honest half of it: everything here is a thing the
// agent actually did or was given, with no capability claim attached.
//
// IT RANKS EVERY AGENT, INCLUDING THE ROOT. It used to list `listProfiles()`
// only, which excludes the root agent at ~/.hermes -- the one a default install
// actually runs, and therefore the only agent on most installs with any work to
// its name. It was reported as `runsCompleted: 0`; the agent was simply not on
// the board (T-0081, RC-D). getAgentPerformance already includes the root, so
// the numbers existed the whole time and nothing asked for them.
// ═══════════════════════════════════════════════════════════════

import { serverErrorFromCatch } from "@/lib/api-logger";
import { ok } from "@/lib/api-response";
import { listProfiles } from "@/modules/hermes/lib/profiles-repository";
import { agentExperienceFromPerformance } from "@/lib/stats/agent-experience";
import { getAgentPerformance } from "@/lib/stats/agent-stats";
import { DEFAULT_PROFILE_SLUG } from "@/lib/profile-slug";

/** What the root agent is called when no profile row supplies a name. */
const ROOT_AGENT_LABEL = "Bob (local default)";

export async function GET() {
  try {
    // Root first, then the named profiles, deduplicated by slug: a profile
    // literally named "default" must not produce the agent twice.
    const labels = new Map<string, string>([[DEFAULT_PROFILE_SLUG, ROOT_AGENT_LABEL]]);
    for (const p of listProfiles()) labels.set(p.slug, p.displayName || p.slug);

    const entries = getAgentPerformance()
      .map((perf) => {
        const xp = agentExperienceFromPerformance(perf);
        return {
          targetRef: perf.slug,
          targetLabel: labels.get(perf.slug) || perf.name || perf.slug,
          experience: xp,
        };
      })
      // Most-grown first, so the dashboard hero shows the agent with the most
      // accumulated work rather than whichever profile sorted first.
      .sort((a, b) => b.experience.xp - a.experience.xp)
      .map((e, i) => ({ rank: i + 1, ...e }));

    return ok({ entries });
  } catch (error) {
    return serverErrorFromCatch(
      "GET /api/agents/experience",
      "rank agent experience",
      error,
      "Failed to load agent experience",
    );
  }
}
