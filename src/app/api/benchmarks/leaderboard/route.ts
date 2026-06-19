// ═══════════════════════════════════════════════════════════════
// GET /api/benchmarks/leaderboard?suite=<key> — local Agent Rating ranking
//
// Ranks agent profiles by their latest completed run's Agent Rating for one
// suite. Local-only for now; the entry shape is what a future hosted
// leaderboard would receive (no sensitive data — see the agent-card route).
// ═══════════════════════════════════════════════════════════════

import { NextRequest } from "next/server";
import { serverErrorFromCatch } from "@/lib/api-logger";
import { ok, badRequest } from "@/lib/api-response";
import { listLeaderboard } from "@/lib/benchmarks/benchmarks-repository";
import { ratingFromRun } from "@/lib/benchmarks/rating";
import { getSuite, listSuiteMeta } from "@/lib/benchmarks/suites";
import { agentExperienceForProfile } from "@/lib/stats/agent-experience";

export async function GET(request: NextRequest) {
  try {
    const suiteKey = request.nextUrl.searchParams.get("suite") || listSuiteMeta()[0]?.key || "";
    if (!suiteKey || !getSuite(suiteKey)) return badRequest("Unknown or missing suite");

    const entries = listLeaderboard(suiteKey).map((run, i) => ({
      rank: i + 1,
      targetRef: run.targetRef,
      targetLabel: run.targetLabel ?? run.targetRef,
      rating: ratingFromRun(run),
      experience: agentExperienceForProfile(run.targetRef),
      ratedAt: run.completedAt,
    }));
    return ok({ suiteKey, entries });
  } catch (error) {
    return serverErrorFromCatch("GET /api/benchmarks/leaderboard", "rank", error, "Failed to load leaderboard");
  }
}
