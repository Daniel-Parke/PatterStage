// ═══════════════════════════════════════════════════════════════
// GET /api/composer/runs/[id]/events — live SSE for a Composer run
//
// Pushes { run, nodeRuns } snapshots as they change (DB is authoritative;
// the page also polls as a fallback). Closes when the run is terminal.
// ═══════════════════════════════════════════════════════════════

import { NextRequest } from "next/server";
import { ensureDb } from "@/lib/db";
import { sseStream } from "@/lib/sse/event-stream";
import { getComposerRun, listNodeRuns } from "@/lib/composer/composer-repository";

interface Ctx {
  params: Promise<{ id: string }>;
}

const TERMINAL = new Set(["completed", "failed", "cancelled"]);

export async function GET(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  ensureDb();
  return sseStream({
    snapshot: () => {
      const run = getComposerRun(id);
      if (!run) return null;
      return { run, nodeRuns: listNodeRuns(id) };
    },
    isTerminal: (s) => TERMINAL.has(s.run.status),
    signal: request.signal,
  });
}
