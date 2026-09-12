// ═══════════════════════════════════════════════════════════════
// GET /api/laboratory/research/[id]/events — live SSE for a research run
//
// Pushes { run, steps } snapshots as they change (DB is authoritative; the
// page also polls as a fallback). Closes when the run is terminal.
// ═══════════════════════════════════════════════════════════════

import { NextRequest } from "next/server";
import { ensureDb } from "@/lib/db";
import { sseStream } from "@/lib/sse/event-stream";
import {
  getResearchRun,
  listResearchSteps,
} from "@/lib/laboratory/deep-research/research-repository";

interface Ctx {
  params: Promise<{ id: string }>;
}

const TERMINAL = new Set(["completed", "failed", "cancelled"]);

export async function GET(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  ensureDb();
  return sseStream({
    snapshot: () => {
      const run = getResearchRun(id);
      if (!run) return null;
      return { run, steps: listResearchSteps(id) };
    },
    isTerminal: (s) => TERMINAL.has(s.run.status),
    signal: request.signal,
  });
}
