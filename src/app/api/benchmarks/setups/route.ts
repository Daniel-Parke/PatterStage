// ═══════════════════════════════════════════════════════════════
// GET /api/benchmarks/setups?suite=<key> — the local agent-setup database
//
// Ranks distinct agent SETUPS (profile + model + exec mode + augmentation) by
// their best benchmark rating, with the agent's Experience level. A reusable,
// comparable record of which configurations actually perform — clone one into
// the launch form to re-run it.
// ═══════════════════════════════════════════════════════════════

import { NextRequest } from "next/server";

import { serverErrorFromCatch } from "@/lib/api-logger";
import { ok, badRequest } from "@/lib/api-response";
import { listAgentSetups } from "@/lib/benchmarks/benchmarks-repository";
import { getSuite, listSuiteMeta } from "@/lib/benchmarks/suites";
import { agentExperienceForProfile } from "@/lib/stats/agent-experience";

export async function GET(request: NextRequest) {
  try {
    const suiteKey = request.nextUrl.searchParams.get("suite") || listSuiteMeta()[0]?.key || "";
    if (!suiteKey || !getSuite(suiteKey)) return badRequest("Unknown or missing suite");

    const setups = listAgentSetups(suiteKey).map((s, i) => ({
      rank: i + 1,
      ...s,
      experience: agentExperienceForProfile(s.profileRef),
    }));
    return ok({ suiteKey, setups });
  } catch (error) {
    return serverErrorFromCatch("GET /api/benchmarks/setups", "rank", error, "Failed to load setups");
  }
}
