// ═══════════════════════════════════════════════════════════════
// GET /api/missions/[id]/run — the latest run for a mission
//
// Lets the mission board resolve a running mission's Control Hub run id so it
// can stream live progress via /api/runs/[id]/events.
// ═══════════════════════════════════════════════════════════════

import { NextRequest } from "next/server";
import { serverErrorFromCatch } from "@/lib/api-logger";
import { ok, notFound } from "@/lib/api-response";
import { getMission } from "@/lib/mission-repository";
import { getLatestRunForMission } from "@/lib/runs-repository";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  try {
    if (!getMission(id)) return notFound("Mission not found");
    return ok({ run: getLatestRunForMission(id) });
  } catch (error) {
    return serverErrorFromCatch("GET /api/missions/[id]/run", `id=${id}`, error, "Failed to load mission run");
  }
}
