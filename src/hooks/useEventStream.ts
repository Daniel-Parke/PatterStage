// ═══════════════════════════════════════════════════════════════
// useEventStream — subscribe to a server-sent-events endpoint
//
// The live-richness layer that pairs with useApiResource polling: returns the
// latest `state` snapshot pushed by the server, a `connected` flag, and any
// server-reported failure. When the stream drops (or isn't supported), the
// caller's useApiResource polling keeps the view correct — durable state is
// always the DB.
//
// A DROPPED SOCKET AND A FAILED READ ARE DIFFERENT FACTS (T-0046). The first
// is routine and self-healing: polling covers it and the browser reconnects.
// The second means the authoritative read itself threw, which polling will hit
// too, and it carries a diagnosis worth showing. They used to be one flag,
// because the server named its failure frame `error` — the name EventSource
// reserves for transport death — so both arrived at `onerror` together and the
// diagnosis was discarded unread.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useEffect, useState } from "react";

export function useEventStream<T>(
  url: string | null,
): { data: T | null; connected: boolean; error: string | null } {
  const [data, setData] = useState<T | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Drop the previous subscription's payload IMMEDIATELY on any url change.
    //
    // Without this, `data` kept the old stream's snapshot until the new stream
    // pushed its first frame. Callers prefer the stream over their fetched copy
    // (`live?.run ?? detail?.run`), so selecting a different Composer run showed
    // the PREVIOUS run's stages — and the HIL Accept button posted to
    // `run.id` taken from that stale payload, approving a node on the wrong run.
    setData(null);
    setConnected(false);
    // A diagnosis belongs to the stream that produced it, not to the next one.
    setError(null);

    if (!url || typeof window === "undefined" || typeof EventSource === "undefined") return;
    const es = new EventSource(url);
    es.onopen = () => setConnected(true);
    es.addEventListener("state", (e) => {
      try {
        setData(JSON.parse((e as MessageEvent).data) as T);
      } catch {
        // ignore malformed frame
      }
    });
    es.addEventListener("stream.error", (e) => {
      // The authoritative read failed server-side. Keep the last good snapshot
      // on screen — it is the truth as of the last successful read — and say
      // what went wrong alongside it.
      let why = "the live stream reported a failure";
      try {
        const parsed = JSON.parse((e as MessageEvent).data) as { error?: unknown };
        if (typeof parsed.error === "string" && parsed.error) why = parsed.error;
      } catch {
        // malformed frame; the default message still beats silence
      }
      setError(why);
    });
    es.addEventListener("end", () => {
      es.close();
      setConnected(false);
    });
    // Transport only. Now that the server names its own failures distinctly,
    // reaching here means the socket dropped, which polling already covers, so
    // it must NOT set `error` and claim a server diagnosis that never arrived.
    es.onerror = () => setConnected(false);
    return () => es.close();
  }, [url]);

  return { data, connected, error };
}
