"use client";

import { useMemo } from "react";
import { Rocket, Loader2, CheckCircle2, XCircle } from "lucide-react";
import Donut from "@/components/viz/Donut";
import ProgressRing from "@/components/viz/ProgressRing";
import { neon, neonAlpha, type NeonColor } from "@/components/viz/colors";
import type { MissionRow } from "@/hooks/missions-page-types";

function Tile({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  value: number;
  color: NeonColor;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2" style={{ boxShadow: `inset 0 0 16px ${neonAlpha(color, 5)}` }}>
      <div className="flex min-w-0 items-center gap-1.5">
        <Icon className="h-3 w-3 shrink-0" style={{ color: neon(color) }} />
        <span className="truncate text-xs uppercase tracking-wider text-ps-text-muted">{label}</span>
      </div>
      <div className="mt-0.5 font-mono text-xl font-bold leading-none text-white">{value}</div>
    </div>
  );
}

/**
 * Compact insights strip for the mission board — status mix donut, count tiles,
 * and a success ring. Computed from the board data itself (no extra fetch), so
 * it reflects exactly what's on screen. Hidden when there are no missions.
 */
export default function MissionInsights({ missions }: { missions: MissionRow[] }) {
  const s = useMemo(() => {
    const c = { queued: 0, dispatched: 0, successful: 0, failed: 0 };
    for (const m of missions) {
      if (m.status in c) c[m.status as keyof typeof c]++;
    }
    const terminal = c.successful + c.failed;
    return {
      ...c,
      total: missions.length,
      active: c.queued + c.dispatched,
      successRate: terminal > 0 ? c.successful / terminal : 0,
    };
  }, [missions]);

  if (missions.length === 0) return null;
  const successPct = Math.round(s.successRate * 100);

  return (
    <div className="animate-float-in mb-5 grid grid-cols-1 items-center gap-5 rounded-2xl border border-white/10 bg-dark-900/40 p-4 sm:grid-cols-[auto_1fr_auto]">
      <div className="flex justify-center">
        <Donut
          size={96}
          thickness={12}
          segments={[
            { label: "Successful", value: s.successful, color: "green" },
            { label: "Failed", value: s.failed, color: "pink" },
            { label: "Dispatched", value: s.dispatched, color: "yellow" },
            { label: "Queued", value: s.queued, color: "cyan" },
          ]}
          center={s.total}
          centerSub="missions"
        />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-[repeat(auto-fit,minmax(7.5rem,1fr))]">
        <Tile icon={Rocket} label="Total" value={s.total} color="cyan" />
        <Tile icon={Loader2} label="Active" value={s.active} color="yellow" />
        <Tile icon={CheckCircle2} label="Done" value={s.successful} color="green" />
        <Tile icon={XCircle} label="Failed" value={s.failed} color="pink" />
      </div>
      <div className="flex justify-center">
        <ProgressRing
          value={s.successRate}
          color="green"
          size={84}
          thickness={8}
          label={<span className="text-sm">{successPct}%</span>}
          sublabel="success"
        />
      </div>
    </div>
  );
}
