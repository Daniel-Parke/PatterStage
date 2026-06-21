// ═══════════════════════════════════════════════════════════════
// POST /api/laboratory/research/[id]/launch — research → V2 mission handoff
//
// Seeds a multi-phase (V2) mission from a completed research report: the report
// becomes the Prepare-phase brief and the canonical Prepare→Implement→Test→
// Release plan is scaffolded. Gated behind the missions_v2 flag (dark until the
// V2 orchestration engine ships). This is the launch point the whiteboard's
// V2 flow starts from.
// ═══════════════════════════════════════════════════════════════

import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { serverErrorFromCatch } from "@/lib/api-logger";
import { ok, badRequest, notFound, serviceUnavailable } from "@/lib/api-response";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { getResearchRun } from "@/lib/laboratory/deep-research/research-repository";
import { createMission } from "@/lib/mission-repository";
import { scaffoldMissionPhases } from "@/lib/mission-phases-repository";
import { DEFAULT_V2_PLAN } from "@/lib/schema/mission-v2";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, ctx: Ctx) {
  const auth = requireAuth(request);
  if (auth) return auth;

  if (!isFeatureEnabled("missions_v2")) {
    return serviceUnavailable(
      "Mission V2 is not enabled. Set PS_MISSIONS_V2=1 to launch multi-phase missions.",
    );
  }

  const { id } = await ctx.params;
  try {
    const run = getResearchRun(id);
    if (!run) return notFound("Research run not found");
    if (run.status !== "completed" || !run.report) {
      return badRequest("Research run is not complete yet");
    }

    const name = `Research: ${run.query.slice(0, 60)}`;
    const prompt =
      `# Research brief\n\n${run.report}\n\n---\n` +
      `Use this research as the plan for the mission's Prepare phase.`;

    const mission = createMission({ name, prompt });
    const phases = scaffoldMissionPhases(mission.id, DEFAULT_V2_PLAN);

    return ok({ missionId: mission.id, phases });
  } catch (error) {
    return serverErrorFromCatch(
      "POST /api/laboratory/research/[id]/launch",
      `id=${id}`,
      error,
      "Failed to launch mission",
    );
  }
}
