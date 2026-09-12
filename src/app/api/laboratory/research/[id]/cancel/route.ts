// ═══════════════════════════════════════════════════════════════
// POST /api/laboratory/research/[id]/cancel — stop a run in flight
//
// The operator's decision is the final word: the row is written here, and
// `runResearchJob` bails out rather than overwriting it (T-0108, D98).
// ═══════════════════════════════════════════════════════════════

import type { NextRequest } from "next/server";

import { ok, notFound, conflict } from "@/lib/api/api-response";
import { recordEvent } from "@/lib/analytics/record-event";
import {
  cancelResearchRun,
  getResearchRun,
} from "@/lib/laboratory/deep-research/research-repository";
import { route } from "@/lib/api/api-route";

interface Ctx {
  params: Promise<{ id: string }>;
}

export const POST = route("POST /api/laboratory/research/[id]/cancel", (p) => `id=${p.id}`, "Failed to cancel research run", async (_request: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  // The lookup is only here to tell an unknown id (404) from a finished run
  // (409); the cancel itself is still one conditional UPDATE.
  if (!getResearchRun(id)) return notFound("Research run not found");

  const run = cancelResearchRun(id);
  if (!run) return conflict("That run has already finished");

  // After the write, never before it: no event claims an outcome the table
  // does not hold.
  recordEvent("research.cancelled", { entityType: "research", entityId: id });
  return ok({ run });
});
