"use client";

import { useMemo } from "react";
import { Activity, Clock, MessageSquare, Terminal } from "lucide-react";
import StatStrip from "@/components/viz/StatStrip";
import type { SessionRecord } from "@/lib/session-repository";

/**
 * Insights strip for the session history — source mix donut, count tiles, and an
 * active-ratio ring. Computed from the loaded session list (no extra fetch);
 * hidden when empty.
 */
export default function SessionInsights({ sessions }: { sessions: SessionRecord[] }) {
  const s = useMemo(() => {
    const src = { cli: 0, mission: 0, cron: 0, api: 0 };
    let active = 0;
    let msgs = 0;
    for (const x of sessions) {
      if (x.status === "active") active++;
      msgs += typeof x.messageCount === "number" ? x.messageCount : 0;
      if (x.source in src) src[x.source as keyof typeof src]++;
    }
    return { total: sessions.length, active, msgs, src };
  }, [sessions]);

  if (sessions.length === 0) return null;

  return (
    <StatStrip
      className="mb-6"
      donut={{
        segments: [
          { label: "CLI", value: s.src.cli, color: "cyan" },
          { label: "Mission", value: s.src.mission, color: "green" },
          { label: "Cron", value: s.src.cron, color: "orange" },
          { label: "API", value: s.src.api, color: "purple" },
        ],
        center: s.total,
        centerSub: "sessions",
      }}
      tiles={[
        { icon: Activity, label: "Active", value: s.active, color: "green" },
        { icon: Clock, label: "Total", value: s.total, color: "cyan" },
        { icon: MessageSquare, label: "Messages", value: s.msgs, color: "orange", compact: true },
        { icon: Terminal, label: "CLI", value: s.src.cli, color: "purple" },
      ]}
      ring={{
        value: s.total > 0 ? s.active / s.total : 0,
        color: "green",
        label: <span className="text-sm">{s.active}</span>,
        sublabel: "active",
      }}
    />
  );
}
