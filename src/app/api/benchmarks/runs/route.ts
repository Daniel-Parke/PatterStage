// ═══════════════════════════════════════════════════════════════
// /api/benchmarks/runs — list + start benchmark runs
//
// GET  — list runs (optional filters: targetKind, targetRef, status, pairId).
// POST — start a run. Two modes:
//   • single  → one target (agent profile OR bare model).
//   • compare → an agent run + a bare-model run sharing a pair_id (the
//               hypothesis test: does the .md config + skills + memory lift
//               performance over the raw model?).
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/api-auth";
import { serverErrorFromCatch } from "@/lib/api-logger";
import { ok, created, badRequest } from "@/lib/api-response";
import { parseAndValidateJsonBody } from "@/lib/parse-json-body";
import { listBenchmarkRuns } from "@/lib/benchmarks/benchmarks-repository";
import { startBenchmarkRun, startComparePair } from "@/lib/benchmarks/executor";
import { getSuite } from "@/lib/benchmarks/suites";
import type { BenchmarkRunStatus, BenchmarkTargetKind } from "@/lib/benchmarks/types";

const runCreateSchema = z
  .object({
    suiteKey: z.string().min(1),
    mode: z.enum(["single", "compare"]).default("single"),
    repeats: z.number().int().min(1).max(10).optional(),
    // single
    targetKind: z.enum(["agent", "model"]).optional(),
    targetRef: z.string().min(1).optional(),
    targetLabel: z.string().optional(),
    // compare
    agentProfile: z.string().min(1).optional(),
    agentLabel: z.string().optional(),
    modelRef: z.string().min(1).optional(),
    modelLabel: z.string().optional(),
  })
  .strict();

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const limitParam = sp.get("limit");
    const runs = listBenchmarkRuns({
      targetKind: (sp.get("targetKind") as BenchmarkTargetKind) || undefined,
      targetRef: sp.get("targetRef") || undefined,
      status: (sp.get("status") as BenchmarkRunStatus) || undefined,
      pairId: sp.get("pairId") || undefined,
      limit: limitParam ? Number(limitParam) : 50,
    });
    return ok({ runs });
  } catch (error) {
    return serverErrorFromCatch("GET /api/benchmarks/runs", "list", error, "Failed to list benchmark runs");
  }
}

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

  const parsed = await parseAndValidateJsonBody(request, runCreateSchema);
  if (parsed instanceof NextResponse) return parsed;

  if (!getSuite(parsed.suiteKey)) {
    return badRequest(`Unknown suite "${parsed.suiteKey}"`);
  }

  try {
    if (parsed.mode === "compare") {
      if (!parsed.agentProfile || !parsed.modelRef) {
        return badRequest("compare mode requires agentProfile and modelRef");
      }
      const pair = startComparePair({
        suiteKey: parsed.suiteKey,
        agentProfile: parsed.agentProfile,
        agentLabel: parsed.agentLabel,
        modelRef: parsed.modelRef,
        modelLabel: parsed.modelLabel,
        repeats: parsed.repeats,
      });
      return created({
        pairId: pair.pairId,
        runs: [pair.agent, pair.model],
        agentRunId: pair.agent.id,
        modelRunId: pair.model.id,
      });
    }

    if (!parsed.targetKind || !parsed.targetRef) {
      return badRequest("single mode requires targetKind and targetRef");
    }
    const run = startBenchmarkRun({
      suiteKey: parsed.suiteKey,
      targetKind: parsed.targetKind,
      targetRef: parsed.targetRef,
      targetLabel: parsed.targetLabel,
      repeats: parsed.repeats,
    });
    return created({ run });
  } catch (error) {
    return serverErrorFromCatch("POST /api/benchmarks/runs", "start", error, "Failed to start benchmark run");
  }
}
