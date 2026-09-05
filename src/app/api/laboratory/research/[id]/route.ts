// ═══════════════════════════════════════════════════════════════
// GET /api/laboratory/research/[id] — one research run + its steps
// ═══════════════════════════════════════════════════════════════

import { NextRequest } from "next/server";
import { serverErrorFromCatch } from "@/lib/api-logger";
import { ok, notFound } from "@/lib/api-response";
import {
  getResearchRun,
  listResearchSteps,
} from "@/lib/laboratory/deep-research/research-repository";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  try {
    const run = getResearchRun(id);
    if (!run) return notFound("Research run not found");
    return ok({ run, steps: listResearchSteps(id) });
  } catch (error) {
    return serverErrorFromCatch("GET /api/laboratory/research/[id]", `id=${id}`, error, "Failed to load research run");
  }
}
