// ═══════════════════════════════════════════════════════════════
// GET /api/missions/[id]/run — the latest run for a mission
//
// Lets the mission board resolve a running mission's PatterStage run id so it
// can stream live progress via /api/runs/[id]/events.
//
// No guard here, deliberately, and this file is the model its siblings were
// normalised onto rather than the anomaly a review once took it for (T-0034).
// Authentication is enforced once, in src/proxy.ts, before any handler runs;
// `design-lint no-auth-in-route-handler` fails the build on a route that tries
// to do it again. The thing the siblings carried was never authentication: it
// was `requireAuth()`, which only checks the read-only flag, and read-only is a
// restriction on writes. A GET that refuses to answer under PS_READ_ONLY is a
// read-only mode that cannot read.
// ═══════════════════════════════════════════════════════════════

import { NextRequest } from "next/server";
import { serverErrorFromCatch } from "@/lib/api-logger";
import { ok, notFound } from "@/lib/api-response";
import { getMission } from "@/lib/missions/mission-repository";
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
