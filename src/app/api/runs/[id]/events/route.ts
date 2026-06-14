// ═══════════════════════════════════════════════════════════════
// GET /api/runs/[id]/events — live run progress (SSE proxy)
//
// Proxies runtime.streamRunEvents() (the backend's /v1/runs/{id}/events SSE)
// to the browser. UX-only: authoritative run state still comes from polling
// (/api/runs/[id] + the background reconcile). If the stream drops, the
// poller backfills within a tick.
// ═══════════════════════════════════════════════════════════════

import { NextRequest } from "next/server";
import { runtime } from "@/lib/runtime";
import { getRun } from "@/lib/runs-repository";

export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const run = getRun(id);
  if (!run) {
    return new Response("run not found", { status: 404 });
  }
  if (!run.runId) {
    return new Response("run not yet submitted to the backend", { status: 409 });
  }

  const backendRunId = run.runId;
  const profile = run.profileName ?? undefined;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      try {
        emit("open", { runId: id, backendRunId });
        for await (const ev of runtime.streamRunEvents(backendRunId, profile)) {
          emit(ev.type, ev.data);
        }
        emit("done", { runId: id });
      } catch (err) {
        emit("error", { message: err instanceof Error ? err.message : String(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
