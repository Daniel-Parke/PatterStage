// ═══════════════════════════════════════════════════════════════
// GET /api/benchmarks/runs/[id] — one run + its per-item results
// ═══════════════════════════════════════════════════════════════

import { NextRequest } from "next/server";
import { serverErrorFromCatch } from "@/lib/api-logger";
import { ok, notFound } from "@/lib/api-response";
import { getBenchmarkRun, listItemResults } from "@/lib/benchmarks/benchmarks-repository";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  try {
    const run = getBenchmarkRun(id);
    if (!run) return notFound("Benchmark run not found");
    return ok({ run, results: listItemResults(id) });
  } catch (error) {
    return serverErrorFromCatch("GET /api/benchmarks/runs/[id]", `id=${id}`, error, "Failed to load benchmark run");
  }
}
