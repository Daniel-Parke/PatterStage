"use client";

// ═══════════════════════════════════════════════════════════════
// ElapsedSince: a live m:ss since an instant
//
// Round 6, finding 13 (T-0089). A composer stage with a long LLM behind it
// showed "started 2 minutes ago" from a 3-second poll and nothing else, and
// the report asked for server heartbeats. Every snapshot already carries the
// node run's startedAt; a one-second ticker on the client needs no server
// change and tells the operator the one thing they wanted: it is still going.
// ═══════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";

function format(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
}

export default function ElapsedSince({ since, className }: { since: string; className?: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [since]);
  const start = Date.parse(since);
  if (!Number.isFinite(start)) return null;
  return (
    <time dateTime={since} className={className ?? "font-mono text-micro text-neon-cyan tabular-nums"}>
      {format(now - start)}
    </time>
  );
}
