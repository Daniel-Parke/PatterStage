// ═══════════════════════════════════════════════════════════════
// GET /api/runs/[id] — current state of one agent run
// ═══════════════════════════════════════════════════════════════

import { NextRequest } from "next/server";
import { serverErrorFromCatch } from "@/lib/api-logger";
import { ok, notFound } from "@/lib/api-response";
import { getRun } from "@/lib/runs-repository";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  try {
    const run = getRun(id);
    if (!run) return notFound("Run not found");
    return ok({ run });
  } catch (error) {
    return serverErrorFromCatch("GET /api/runs/[id]", `id=${id}`, error, "Failed to load run");
  }
}
