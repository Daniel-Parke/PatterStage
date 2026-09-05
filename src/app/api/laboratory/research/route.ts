// ═══════════════════════════════════════════════════════════════
// /api/laboratory/research — list + start native DeepResearch runs
//
// GET  — recent research runs.
// POST — start a run: create the row, kick off the engine async (fire-and-
//        forget), return the pending run. The page polls GET /[id] for steps.
// ═══════════════════════════════════════════════════════════════

import { boundsFrom } from "@/lib/list-bounds";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { serverErrorFromCatch } from "@/lib/api-logger";
import { ok, created } from "@/lib/api-response";
import { ensureDb } from "@/lib/db";
import { parseAndValidateJsonBody } from "@/lib/parse-json-body";
import { createResearchRun, listResearchRuns } from "@/lib/laboratory/deep-research/research-repository";
import { runResearchJob } from "@/lib/laboratory/deep-research/run-job";
import { recordEvent } from "@/lib/analytics/record-event";

const configSchema = z
  .object({
    modelId: z.string().min(1).optional(),
    searchProvider: z.enum(["duckduckgo", "searxng", "none"]).optional(),
    rounds: z.number().int().min(1).max(8).optional(),
    resultsPerQuery: z.number().int().min(1).max(12).optional(),
    visitsPerRound: z.number().int().min(0).max(6).optional(),
  })
  .strict();

const startSchema = z
  .object({
    query: z.string().min(3).max(2000),
    config: configSchema.optional(),
  })
  .strict();

export async function GET(request?: NextRequest) {
  try {
    ensureDb();
    return ok({ runs: listResearchRuns(boundsFrom(request, { defaultLimit: 50, maxLimit: 500 }).limit) });
  } catch (error) {
    return serverErrorFromCatch("GET /api/laboratory/research", "list", error, "Failed to list research runs");
  }
}

export async function POST(request: NextRequest) {
  const parsed = await parseAndValidateJsonBody(request, startSchema);
  if (parsed instanceof NextResponse) return parsed;

  try {
    ensureDb();
    const config = parsed.config ?? {};
    const run = createResearchRun({ query: parsed.query, modelId: config.modelId ?? null, config });
    // The row is the start; the outcome is recorded by the job when it ends (T-0098).
    recordEvent("research.started", { entityType: "research", entityId: run.id });
    // Fire-and-forget: the engine runs in the background; the page polls.
    void runResearchJob(run.id, parsed.query, config);
    return created({ run });
  } catch (error) {
    return serverErrorFromCatch("POST /api/laboratory/research", "start", error, "Failed to start research run");
  }
}
