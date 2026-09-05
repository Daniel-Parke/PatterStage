// ═══════════════════════════════════════════════════════════════
// POST /api/laboratory/research/[id]/cancel — stop a run in flight
//
// The operator's decision is the final word: the row is written here, and
// `runResearchJob` bails out rather than overwriting it (T-0108, D98).
// ═══════════════════════════════════════════════════════════════

import type { NextRequest } from "next/server";

import { serverErrorFromCatch } from "@/lib/api-logger";
import { ok, notFound, conflict } from "@/lib/api-response";
import { recordEvent } from "@/lib/analytics/record-event";
import {
  cancelResearchRun,
  getResearchRun,
} from "@/lib/laboratory/deep-research/research-repository";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function POST(_request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  try {
    // The lookup is only here to tell an unknown id (404) from a finished run
    // (409); the cancel itself is still one conditional UPDATE.
    if (!getResearchRun(id)) return notFound("Research run not found");

    const run = cancelResearchRun(id);
    if (!run) return conflict("That run has already finished");

    // After the write, never before it: no event claims an outcome the table
    // does not hold.
    recordEvent("research.cancelled", { entityType: "research", entityId: id });
    return ok({ run });
  } catch (error) {
    return serverErrorFromCatch(
      "POST /api/laboratory/research/[id]/cancel",
      `id=${id}`,
      error,
      "Failed to cancel research run",
    );
  }
}
