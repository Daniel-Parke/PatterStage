// ═══════════════════════════════════════════════════════════════
// /api/laboratory/research — list + start native DeepResearch runs
//
// GET  — recent research runs.
// POST — start a run: create the row, kick off the engine async (fire-and-
//        forget), return the pending run. The page polls GET /[id] for steps.
// ═══════════════════════════════════════════════════════════════

import { boundsFrom } from "@/lib/ui/list-bounds";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { ok, created } from "@/lib/api/api-response";
import { ensureDb } from "@/lib/db";
import { parseAndValidateJsonBody } from "@/lib/api/parse-json-body";
import { createResearchRun, listResearchRuns } from "@/lib/laboratory/deep-research/research-repository";
import { runResearchJob } from "@/lib/laboratory/deep-research/run-job";
import { recordEvent } from "@/lib/analytics/record-event";
import { route } from "@/lib/api/api-route";

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

export const GET = route("GET /api/laboratory/research", "list", "Failed to list research runs", async (request?: NextRequest) => {
  ensureDb();
  return ok({ runs: listResearchRuns(boundsFrom(request, { defaultLimit: 50, maxLimit: 500 }).limit) });
});

export const POST = route("POST /api/laboratory/research", "start", "Failed to start research run", async (request: NextRequest) => {
  const parsed = await parseAndValidateJsonBody(request, startSchema);
  if (parsed instanceof NextResponse) return parsed;
  ensureDb();
  const config = parsed.config ?? {};
  const run = createResearchRun({ query: parsed.query, modelId: config.modelId ?? null, config });
  // The row is the start; the outcome is recorded by the job when it ends (T-0098).
  recordEvent("research.started", { entityType: "research", entityId: run.id });
  // Fire-and-forget: the engine runs in the background; the page polls.
  void runResearchJob(run.id, parsed.query, config);
  return created({ run });
});
