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
import { messageFromError } from "@/lib/api-fetch";

/**
 * The run-level failure event.
 *
 * NOT "error". EventSource owns that name: the browser fires a built-in event
 * of exactly that type when the transport drops, and that event is a plain
 * Event with no `data`. A frame sent under the same name is therefore
 * indistinguishable from a dead socket at the listener, which is precisely
 * what went wrong: the chat client parsed `undefined`, fell through to a
 * hardcoded "run failed", and latched its terminal state before the transport
 * handler could reconcile the real outcome from the server.
 *
 * So the run's own failure travels under a name only this proxy can send.
 */
const RUN_ERROR_EVENT = "run.error";

/**
 * Backend event names pass through untouched, with one exception: a backend
 * event that is itself called "error" would reintroduce the same collision one
 * hop later, so it is renamed on the way out for the same reason.
 */
function wireEventName(type: string): string {
  return type === "error" ? RUN_ERROR_EVENT : type;
}

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
          emit(wireEventName(ev.type), ev.data);
        }
        emit("done", { runId: id });
      } catch (err) {
        // messageFromError, not err.message: with the gateway stopped, undici
        // throws "TypeError: fetch failed" and hides "connect ECONNREFUSED
        // 127.0.0.1:8642" one level down in `cause`. The wrapper alone tells
        // the user nothing they can act on.
        emit(RUN_ERROR_EVENT, { message: messageFromError(err, "run event stream failed") });
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
