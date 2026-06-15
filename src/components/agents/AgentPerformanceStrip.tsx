"use client";

import { useMemo } from "react";
import { Bot, Activity } from "lucide-react";
import { useStats } from "@/hooks/useStats";
import { neon, neonAlpha, type NeonColor } from "@/components/viz/colors";

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return String(Math.round(n));
}

/**
 * Per-agent performance summary on the Agents page — real metrics derived from
 * actual activity (runs · mission success · tokens · avg run time). Analytics,
 * not a game: sourced from /api/stats `agents[]` (see lib/stats/agent-stats.ts).
 */
export default function AgentPerformanceStrip() {
  const { stats } = useStats();
  const agents = useMemo(() => (stats?.agents ?? []).filter((a) => a.runs > 0 || a.missionsCompleted > 0 || a.missionsFailed > 0), [stats]);

  if (agents.length === 0) return null;

  return (
    <div className="animate-float-in mb-5 rounded-2xl border border-white/10 bg-dark-900/40 p-4">
      <div className="mb-3 flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-white/50">
        <Activity className="h-3.5 w-3.5 text-neon-cyan" /> Agent performance · from real activity
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {agents.map((a) => {
          const terminal = a.missionsCompleted + a.missionsFailed;
          const successPct = terminal > 0 ? Math.round((a.missionsCompleted / terminal) * 100) : null;
          const color: NeonColor = a.slug === "default" ? "cyan" : "purple";
          return (
            <div
              key={a.slug}
              className="rounded-xl border p-3"
              style={{ borderColor: neonAlpha(color, 25), background: neonAlpha(color, 5) }}
            >
              <div className="mb-2 flex items-center gap-2">
                <div
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg font-mono text-[11px] font-bold"
                  style={{ background: neonAlpha(color, 18), color: neon(color) }}
                >
                  {a.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-white/85">{a.name}</div>
                  <div className="flex items-center gap-1 text-[10px] font-mono text-white/30">
                    <Bot className="h-3 w-3" /> {a.skills} skills · {a.toolsets} toolsets
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-1 text-center">
                <Metric label="runs" value={String(a.runs)} color="green" />
                <Metric label="success" value={successPct === null ? "—" : `${successPct}%`} color="cyan" />
                <Metric label="tokens" value={fmtTokens(a.totalTokens)} color="yellow" />
                <Metric label="avg" value={a.avgDurationSec > 0 ? `${a.avgDurationSec}s` : "—"} color="purple" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color: NeonColor }) {
  return (
    <div className="rounded-lg bg-white/[0.02] px-1 py-1.5">
      <div className="font-mono text-sm font-bold leading-none" style={{ color: neon(color) }}>
        {value}
      </div>
      <div className="mt-0.5 text-[9px] uppercase tracking-wider text-white/35">{label}</div>
    </div>
  );
}
