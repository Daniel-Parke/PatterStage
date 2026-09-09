// useEventStream — subscribe to a server-sent-events endpoint. The live layer
// over useApiResource polling; when the stream drops, polling keeps the view
// correct, and durable state is always the DB.
//
// A DROPPED SOCKET AND A FAILED READ ARE DIFFERENT FACTS (T-0046). The first is
// routine and self-healing; the second means the authoritative read threw and
// carries a diagnosis. They were one flag because the server named its failure
// frame `error`, the name EventSource reserves for transport death.

"use client";

import { useEffect, useState } from "react";

export function useEventStream<T>(
  url: string | null,
): { data: T | null; connected: boolean; error: string | null } {
  const [data, setData] = useState<T | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Drop the previous subscription's payload IMMEDIATELY on a url change:
    // callers prefer the stream over their fetched copy, so selecting another
    // Composer run showed the PREVIOUS run's stages, and HIL Accept posted to
    // the stale `run.id`, approving a node on the wrong run.
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
      // The authoritative read failed server-side: keep the last good snapshot and say what went wrong beside it.
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
    // Transport only: the socket dropped, which polling covers, so it must NOT
    // set `error` and claim a server diagnosis that never arrived.
    es.onerror = () => setConnected(false);
    return () => es.close();
  }, [url]);

  return { data, connected, error };
}
