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
// ═══════════════════════════════════════════════════════════════

import { serverErrorFromCatch } from "@/lib/api-logger";
import { ok } from "@/lib/api-response";
import { listProfiles } from "@/modules/hermes/lib/profiles-repository";
import { agentExperienceForProfile } from "@/lib/stats/agent-experience";

export async function GET() {
  try {
    const entries = listProfiles()
      .map((p) => {
        const xp = agentExperienceForProfile(p.slug);
        return xp ? { targetRef: p.slug, targetLabel: p.displayName || p.slug, experience: xp } : null;
      })
      .filter((e): e is NonNullable<typeof e> => e !== null)
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
