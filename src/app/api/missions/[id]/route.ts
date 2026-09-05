// ═══════════════════════════════════════════════════════════════
// GET /api/missions/[id] — single-mission read (REST symmetry with the
// cancel/dispatch/run sub-routes). The list endpoint also accepts ?id=.
// ═══════════════════════════════════════════════════════════════

import { NextRequest } from "next/server";
import { serverErrorFromCatch } from "@/lib/api-logger";
import { ok, notFound } from "@/lib/api-response";
import { ensureDb } from "@/lib/db";
import { getMission } from "@/lib/missions/mission-repository";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  try {
    ensureDb();
    const mission = getMission(id);
    if (!mission) return notFound("Mission not found");
    return ok({ mission });
  } catch (error) {
    return serverErrorFromCatch("GET /api/missions/[id]", `id=${id}`, error, "Failed to load mission");
  }
}
