import type { RouteContext } from "@/lib/api/api-route";
// ═══════════════════════════════════════════════════════════════
// GET /api/composer/runs/[id]/events — live SSE for a Composer run
//
// Pushes { run, nodeRuns } snapshots as they change (DB is authoritative;
// the page also polls as a fallback). Closes when the run is terminal.
// ═══════════════════════════════════════════════════════════════

import { guardRoute } from "@/lib/api/response-route";
import { NextRequest } from "next/server";
import { ensureDb } from "@/lib/db";
import { composerOff } from "@/lib/feature-flags-guard";
import { sseStream } from "@/lib/sse/event-stream";
import { streamAuthorizer } from "@/lib/auth/stream-guard";
import { getComposerRun, listNodeRuns } from "@/lib/composer/composer-repository";
import { isTerminalComposerRunStatus } from "@/lib/composer/schema";

type Ctx = RouteContext<{ id: string }>;

// The one list, not a local copy: a status that ends a run but is missing here
// leaves the stream open on a finished run forever. See schema.ts.

async function GETImpl(request: NextRequest, ctx: Ctx) {
  // The same guard every other composer route carries. This one served an
  // existing run with the feature off, and docs/reference/api.md described the exception
  // rather than closing it (T-0095, D5).
  const unavailable = composerOff();
  if (unavailable) return unavailable;
  const { id } = await ctx.params;
  ensureDb();
  return sseStream({
    authorize: streamAuthorizer(request),
    snapshot: () => {
      const run = getComposerRun(id);
      if (!run) return null;
      return { run, nodeRuns: listNodeRuns(id) };
    },
    isTerminal: (s) => isTerminalComposerRunStatus(s.run.status),
    signal: request.signal,
  });
}

export const GET = guardRoute(GETImpl);
