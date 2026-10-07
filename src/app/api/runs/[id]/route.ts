// ═══════════════════════════════════════════════════════════════
// GET /api/runs/[id] — current state of one agent run
// ═══════════════════════════════════════════════════════════════

import { NextRequest } from "next/server";
import { ok, notFound } from "@/lib/api/api-response";
import { getRun } from "@/lib/runs/runs-repository";
import { route, type RouteContext } from "@/lib/api/api-route";

type Ctx = RouteContext<{ id: string }>;

export const GET = route("GET /api/runs/[id]", (p) => `id=${p.id}`, "Failed to load run", async (_request: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  const run = getRun(id);
  if (!run) return notFound("Run not found");
  return ok({ run });
});
