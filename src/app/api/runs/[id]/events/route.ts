// ═══════════════════════════════════════════════════════════════
// GET /api/runs/[id]/events — live run progress (SSE proxy)
//
// Proxies runtime.streamRunEvents() (the backend's /v1/runs/{id}/events SSE)
// to the browser. UX-only: authoritative run state still comes from polling
// (/api/runs/[id] + the background reconcile). If the stream drops, the
// poller backfills within a tick.
//
// The proxy lets go when the client does. It used to ignore the request's
// abort signal, so a browser that navigated away left the upstream stream open
// on the gateway until the run ended (T-0095, D127). Now the request signal and
// the stream's own cancel() both abort the upstream fetch.
// ═══════════════════════════════════════════════════════════════

import { guardRoute } from "@/lib/api/response-route";
import { NextRequest } from "next/server";
import { runtime } from "@/lib/runtime";
import { getRun } from "@/lib/runs/runs-repository";
import { messageFromError } from "@/lib/api/api-fetch";
import { streamAuthorizer } from "@/lib/auth/stream-guard";

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

async function GETImpl(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const authorised = streamAuthorizer(request);
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

  // One controller for the upstream fetch, pulled by either end going away.
  const upstream = new AbortController();
  let closeLocal: (() => void) | null = null;
  const abortUpstream = () => { upstream.abort(); closeLocal?.(); };
  const requestSignal = request.signal;
  requestSignal.addEventListener("abort", abortUpstream, { once: true });
  let closed = false;
  let guardInterval: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const stop = () => {
        if (closed) return;
        closed = true;
        upstream.abort();
        if (guardInterval) clearInterval(guardInterval);
        requestSignal.removeEventListener("abort", abortUpstream);
        try { controller.close(); } catch { /* client already closed */ }
      };
      guardInterval = setInterval(() => { if (!authorised()) stop(); }, 1000);
      const emit = (event: string, data: unknown) => {
        if (closed || !authorised()) { stop(); return; }
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          // The client cancelled between the check and the enqueue.
          stop();
        }
      };
      if (run.composerNodeRunId) {
        closeLocal = stop;
        const tick = () => {
          if (closed) return;
          if (!authorised() || requestSignal.aborted) { stop(); return; }
          try {
            const current = getRun(id);
            if (!current) { emit(RUN_ERROR_EVENT, { message: "run not found" }); stop(); return; }
            if (current.status === "started") return;
            const data = { run_id: backendRunId, output: current.output, usage: current.usage, error: current.error };
            emit(current.status === "failed" ? RUN_ERROR_EVENT : `run.${current.status}`,
              current.status === "failed" ? { ...data, message: current.error ?? "run failed" } : data);
            emit("done", { runId: id });
            stop();
          } catch { emit(RUN_ERROR_EVENT, { message: "run state unavailable" }); stop(); }
        };
        if (guardInterval) clearInterval(guardInterval);
        emit("open", { runId: id, backendRunId });
        tick();
        if (!closed) guardInterval = setInterval(tick, 1000);
        return;
      }
      try {
        emit("open", { runId: id, backendRunId });
        for await (const ev of runtime.streamRunEvents(backendRunId, profile, upstream.signal)) {
          if (closed) break;
          emit(wireEventName(ev.type), ev.data);
        }
        emit("done", { runId: id });
      } catch (err) {
        // messageFromError, not err.message: with the gateway stopped, undici
        // throws "TypeError: fetch failed" and hides "connect ECONNREFUSED
        // 127.0.0.1:8642" one level down in `cause`. The wrapper alone tells
        // the user nothing they can act on. An abort we caused is not an error
        // worth a frame: nobody is listening.
        if (!upstream.signal.aborted) {
          emit(RUN_ERROR_EVENT, { message: messageFromError(err, "run event stream failed") });
        }
      } finally {
        closed = true;
        if (guardInterval) clearInterval(guardInterval);
        requestSignal.removeEventListener("abort", abortUpstream);
        try {
          controller.close();
        } catch {
          // already cancelled by the client
        }
      }
    },
    cancel() {
      closeLocal?.();
      closed = true;
      if (guardInterval) clearInterval(guardInterval);
      upstream.abort();
      requestSignal.removeEventListener("abort", abortUpstream);
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

export const GET = guardRoute(GETImpl);
