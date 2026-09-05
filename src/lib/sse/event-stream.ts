// ═══════════════════════════════════════════════════════════════
// sse/event-stream.ts — reusable server-sent-events helper
//
// Durable state lives in the DB (polling is authoritative); SSE is the live
// richness layer. Because PatterStage can run multiple processes (the
// scheduler ownership lease), we bridge via the shared DB: the stream polls a
// `snapshot()` of the authoritative rows and pushes a `state` event whenever it
// changes, with `:` heartbeats in between, closing on a terminal snapshot or
// client disconnect. The client degrades to useApiResource polling if it drops.
// ═══════════════════════════════════════════════════════════════

export interface SseStreamOptions<T> {
  /** Current authoritative state. Return null when the resource is gone. */
  snapshot: () => T | null;
  /** Close the stream after emitting a snapshot for which this is true. */
  isTerminal?: (snap: T) => boolean;
  /** Poll cadence in ms (default 1000). */
  intervalMs?: number;
  /** Client-disconnect signal (request.signal). */
  signal?: AbortSignal;
}

/** Build a `text/event-stream` Response that pushes snapshot deltas. */
export function sseStream<T>(opts: SseStreamOptions<T>): Response {
  const intervalMs = opts.intervalMs ?? 1000;
  const encoder = new TextEncoder();
  let lastJson = "";
  let interval: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const enqueue = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // controller already closed
        }
      };
      const close = () => {
        if (interval) clearInterval(interval);
        interval = null;
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      // Returns true when the stream should stop.
      const tick = (): boolean => {
        let snap: T | null;
        try {
          snap = opts.snapshot();
        } catch (e) {
          // NOT `event: error`. EventSource reserves that name for its own
          // transport failure and dispatches it with NO `data`, so a server
          // frame sharing the name arrives indistinguishable from a dropped
          // socket and its diagnosis is thrown away. T-0040 fixed this exact
          // collision on the chat run stream; this is the same rename for the
          // composer and laboratory research streams (T-0046).
          //
          // JSON.stringify rather than a hand-built literal: a real message
          // can carry a quote or a backslash, and a Windows path has both.
          const why = e instanceof Error ? e.message : "snapshot failed";
          enqueue(`event: stream.error\ndata: ${JSON.stringify({ error: why })}\n\n`);
          return true;
        }
        if (snap === null) {
          enqueue(`event: end\ndata: {"reason":"gone"}\n\n`);
          return true;
        }
        const json = JSON.stringify(snap);
        if (json !== lastJson) {
          lastJson = json;
          enqueue(`event: state\ndata: ${json}\n\n`);
        } else {
          enqueue(`: ping\n\n`); // heartbeat (comment line)
        }
        if (opts.isTerminal?.(snap)) {
          enqueue(`event: end\ndata: {"reason":"terminal"}\n\n`);
          return true;
        }
        return false;
      };

      if (tick()) {
        close();
        return;
      }
      interval = setInterval(() => {
        if (tick()) close();
      }, intervalMs);
      opts.signal?.addEventListener("abort", close);
    },
    cancel() {
      if (interval) clearInterval(interval);
      interval = null;
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
