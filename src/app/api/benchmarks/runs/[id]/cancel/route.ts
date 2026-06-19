// ═══════════════════════════════════════════════════════════════
// POST /api/benchmarks/runs/[id]/cancel — cancel a pending/running run
// ═══════════════════════════════════════════════════════════════

import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { serverErrorFromCatch } from "@/lib/api-logger";
import { ok, notFound } from "@/lib/api-response";
import { getBenchmarkRun } from "@/lib/benchmarks/benchmarks-repository";
import { cancelBenchmarkRun } from "@/lib/benchmarks/executor";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, ctx: Ctx) {
  const auth = requireAuth(request);
  if (auth) return auth;

  const { id } = await ctx.params;
  try {
    if (!getBenchmarkRun(id)) return notFound("Benchmark run not found");
    const cancelled = cancelBenchmarkRun(id);
    return ok({ cancelled });
  } catch (error) {
    return serverErrorFromCatch("POST /api/benchmarks/runs/[id]/cancel", `id=${id}`, error, "Failed to cancel run");
  }
}
