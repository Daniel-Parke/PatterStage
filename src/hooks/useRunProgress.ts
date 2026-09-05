// ═══════════════════════════════════════════════════════════════
// useRunProgress — live run progress over SSE (/api/runs/[id]/events)
//
// UX-only: streams token deltas + tool events for a live agent run so the UI
// can show progress without polling. Authoritative run state still comes from
// /api/runs/[id] + the background reconcile; if the stream drops, the poller
// backfills.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useEffect, useState } from "react";

type RunProgressStatus = "idle" | "connecting" | "streaming" | "done" | "error";

interface RunProgressEvent {
  type: string;
  data: unknown;
}

export interface RunProgressState {
  events: RunProgressEvent[];
  /** Accumulated output_text deltas. */
  text: string;
  status: RunProgressStatus;
  error?: string;
}

// Real Hermes (0.16) emits message.delta / reasoning.available / run.completed /
// run.failed. The response.* names are kept as a superset for any backend that
// uses the OpenAI-Responses-style stream.
//
// "error" appears in neither list, and must not be added back. EventSource
// fires a built-in event of that exact type when the transport drops, so a
// subscription to it fires on a plain Event with no `data` and records a run
// failure that never happened — while also pre-empting the onerror handler
// below, whose entire job is to say "the stream dropped" instead. The proxy
// sends the run's own failure as "run.error".
const TERMINAL = new Set(["done", "run.completed", "response.completed"]);
const FAILED = new Set(["run.failed", "run.error"]);
const DELTA_EVENTS = new Set(["message.delta", "response.output_text.delta"]);
const SSE_EVENTS = [
  "open",
  "message.delta",
  "reasoning.available",
  "run.completed",
  "run.failed",
  "run.cancelled",
  "response.created",
  "response.output_text.delta",
  "response.output_item.added",
  "response.completed",
  "done",
  "run.error",
];

export function useRunProgress(runId: string | null): RunProgressState {
  const [state, setState] = useState<RunProgressState>({
    events: [],
    text: "",
    status: "idle",
  });

  useEffect(() => {
    if (!runId) {
      setState({ events: [], text: "", status: "idle" });
      return;
    }
    setState({ events: [], text: "", status: "connecting" });

    const es = new EventSource(`/api/runs/${runId}/events`);

    const handle = (type: string) => (e: MessageEvent) => {
      let data: unknown = e.data;
      try {
        data = JSON.parse(e.data);
      } catch {
        /* keep raw string */
      }
      setState((prev) => {
        const events = [...prev.events, { type, data }];
        const obj = data && typeof data === "object" ? (data as Record<string, unknown>) : null;
        let text = prev.text;
        if (DELTA_EVENTS.has(type) && obj && "delta" in obj) {
          text += String(obj.delta ?? "");
        }
        // run.completed carries the final output; use it if no deltas streamed.
        if (type === "run.completed" && obj && typeof obj.output === "string" && !text) {
          text = obj.output;
        }
        let status: RunProgressStatus = prev.status === "connecting" ? "streaming" : prev.status;
        let error = prev.error;
        if (TERMINAL.has(type)) status = "done";
        if (FAILED.has(type)) {
          status = "error";
          error = String(
            (obj?.message as string | undefined) ?? (obj?.error as string | undefined) ?? "run failed",
          );
        }
        if (type === "run.cancelled") status = "done";
        return { events, text, status, error };
      });
    };

    const handlers = new Map<string, (e: MessageEvent) => void>();
    for (const type of SSE_EVENTS) {
      const fn = handle(type);
      handlers.set(type, fn);
      es.addEventListener(type, fn as EventListener);
    }
    es.onerror = () => {
      // EventSource gives an error event with no detail, so there is no server
      // message to pass on. But "error" with an empty reason rendered as a red
      // icon and nothing else, which reads as "the run failed" rather than "the
      // stream dropped". Those are different facts and the poller settles the
      // first one; say which this is.
      setState((prev) =>
        prev.status === "done"
          ? prev
          : {
              ...prev,
              status: "error",
              error:
                prev.error ??
                "event stream disconnected; the run may still be going, and the reconciler holds the authoritative state",
            },
      );
      es.close();
    };

    return () => {
      for (const [type, fn] of handlers) es.removeEventListener(type, fn as EventListener);
      es.close();
    };
  }, [runId]);

  return state;
}
