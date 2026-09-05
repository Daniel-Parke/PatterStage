// ═══════════════════════════════════════════════════════════════
// GET /api/composer/runs/[id]/events — live SSE for a Composer run
//
// Pushes { run, nodeRuns } snapshots as they change (DB is authoritative;
// the page also polls as a fallback). Closes when the run is terminal.
// ═══════════════════════════════════════════════════════════════

import { NextRequest } from "next/server";
import { serviceUnavailable } from "@/lib/api-response";
import { ensureDb } from "@/lib/db";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { sseStream } from "@/lib/sse/event-stream";
import { getComposerRun, listNodeRuns } from "@/lib/composer/composer-repository";
import { isTerminalComposerRunStatus } from "@/lib/composer/schema";

interface Ctx {
  params: Promise<{ id: string }>;
}

// The one list, not a local copy: a status that ends a run but is missing here
// leaves the stream open on a finished run forever. See schema.ts.

export async function GET(request: NextRequest, ctx: Ctx) {
  // The same guard every other composer route carries. This one served an
  // existing run with the feature off, and docs/reference/api.md described the exception
  // rather than closing it (T-0095, D5).
  if (!isFeatureEnabled("composer")) {
    return serviceUnavailable("Composer is not enabled. Set PS_COMPOSER=1 to enable workflows.");
  }
  const { id } = await ctx.params;
  ensureDb();
  return sseStream({
    snapshot: () => {
      const run = getComposerRun(id);
      if (!run) return null;
      return { run, nodeRuns: listNodeRuns(id) };
    },
    isTerminal: (s) => isTerminalComposerRunStatus(s.run.status),
    signal: request.signal,
  });
}
