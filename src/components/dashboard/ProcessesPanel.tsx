// ═══════════════════════════════════════════════════════════════
// ProcessesPanel — dashboard "Running Hermes Processes" grid
// ═══════════════════════════════════════════════════════════════
//
// Extracted from the dashboard god-page (src/app/page.tsx). Renders the
// process cards (or an empty state) with a manual refresh affordance.
// Computes the "N Active" count internally from the process list.

"use client";

import { useMemo } from "react";
import { Radio, RefreshCw } from "lucide-react";

import { timeAgo, titleCase } from "@/lib/utils";
import type { HermesProcess } from "@/types/console";

export interface ProcessesPanelProps {
  processes: HermesProcess[];
  onRefresh: () => void;
}

export default function ProcessesPanel({ processes, onRefresh }: ProcessesPanelProps) {
  const activeCount = useMemo(
    () => processes.filter((p) => p.status === "running").length,
    [processes],
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-mono text-white/40 uppercase tracking-widest flex items-center gap-2">
          <Radio className="w-3 h-3 text-neon-purple" />
          Running Hermes Processes
          <span className="text-[10px] text-white/25 ml-1">({activeCount} Active)</span>
        </h2>
        <RefreshCw
          className="w-3 h-3 text-white/20 hover:text-white/50 cursor-pointer"
          onClick={onRefresh}
        />
      </div>
      {processes.length === 0 ? (
        <div className="rounded-xl border border-neon-purple/20 bg-dark-900/50 p-6 text-center">
          <Radio className="w-8 h-8 text-white/20 mx-auto mb-2" />
          <div className="text-xs text-white/30">No Active Processes Detected</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {processes.map((proc) => (
            <div key={proc.id} className="rounded-xl border border-neon-purple/20 bg-dark-900/50 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Radio className={`w-4 h-4 ${proc.status === "running" ? "text-neon-green pulse-glow" : "text-white/30"}`} />
                  <span className="text-sm text-white/90 font-medium truncate">{proc.name}</span>
                </div>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                  proc.status === "running" ? "bg-neon-green/10 text-neon-green" : "bg-white/5 text-white/30"
                }`}>
                  {titleCase(proc.status)}
                </span>
              </div>
              <div className="space-y-1 text-[10px] font-mono text-white/40">
                <div className="flex justify-between">
                  <span>Type</span>
                  <span className="text-white/60 capitalize">{proc.type}</span>
                </div>
                {proc.model !== "unknown" && proc.model !== "gateway" && (
                  <div className="flex justify-between">
                    <span>Model</span>
                    <span className="text-white/60">{proc.model}</span>
                  </div>
                )}
                {proc.turns > 0 && (
                  <div className="flex justify-between">
                    <span>Turns</span>
                    <span className="text-white/60">{proc.turns}</span>
                  </div>
                )}
                {proc.lastActivity && (
                  <div className="flex justify-between">
                    <span>Last activity</span>
                    <span className="text-white/60">{timeAgo(proc.lastActivity)}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
