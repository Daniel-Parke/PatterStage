// ═══════════════════════════════════════════════════════════════
// useEventStream — subscribe to a server-sent-events endpoint
//
// The live-richness layer that pairs with useApiResource polling: returns the
// latest `state` snapshot pushed by the server, plus a `connected` flag. When
// the stream drops (or isn't supported), the caller's useApiResource polling
// keeps the view correct — durable state is always the DB.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useEffect, useState } from "react";

export function useEventStream<T>(url: string | null): { data: T | null; connected: boolean } {
  const [data, setData] = useState<T | null>(null);
  const [connected, setConnected] = useState(false);

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
    es.addEventListener("end", () => {
      es.close();
      setConnected(false);
    });
    es.onerror = () => setConnected(false);
    return () => es.close();
  }, [url]);

  return { data, connected };
}
