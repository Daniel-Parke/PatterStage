// ═══════════════════════════════════════════════════════════════
// GET /api/missions/[id] — single-mission read (REST symmetry with the
// cancel/dispatch/run sub-routes). The list endpoint also accepts ?id=.
// ═══════════════════════════════════════════════════════════════

import { NextRequest } from "next/server";
import { ok, notFound } from "@/lib/api/api-response";
import { ensureDb } from "@/lib/db";
import { getMission } from "@/lib/missions/mission-repository";
import { route, type RouteContext } from "@/lib/api/api-route";

type Ctx = RouteContext<{ id: string }>;

export const GET = route("GET /api/missions/[id]", (p) => `id=${p.id}`, "Failed to load mission", async (_request: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  ensureDb();
  const mission = getMission(id);
  if (!mission) return notFound("Mission not found");
  return ok({ mission });
});
