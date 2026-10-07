// ═══════════════════════════════════════════════════════════════
// GET /api/laboratory/research/[id] — one research run + its steps
// ═══════════════════════════════════════════════════════════════

import { NextRequest } from "next/server";
import { ok, notFound } from "@/lib/api/api-response";
import {
  getResearchRun,
  listResearchSteps,
} from "@/lib/laboratory/deep-research/research-repository";
import { route, type RouteContext } from "@/lib/api/api-route";

type Ctx = RouteContext<{ id: string }>;

export const GET = route("GET /api/laboratory/research/[id]", (p) => `id=${p.id}`, "Failed to load research run", async (_request: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  const run = getResearchRun(id);
  if (!run) return notFound("Research run not found");
  return ok({ run, steps: listResearchSteps(id) });
});
