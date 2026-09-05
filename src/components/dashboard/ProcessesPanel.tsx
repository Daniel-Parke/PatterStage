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
        <h2 className="text-sm font-mono text-ps-text-muted uppercase tracking-widest flex items-center gap-2">
          <Radio className="w-3 h-3 text-neon-purple" />
          Running Hermes Processes
          <span className="text-xs text-ps-text-faint ml-1">({activeCount} Active)</span>
        </h2>
        <RefreshCw
          className="w-3 h-3 text-white/20 hover:text-ps-text-muted cursor-pointer"
          onClick={onRefresh}
        />
      </div>
      {processes.length === 0 ? (
        <div className="rounded-xl border border-neon-purple/20 bg-dark-900/50 p-6 text-center">
          <Radio className="w-8 h-8 text-white/20 mx-auto mb-2" />
          <div className="text-xs text-ps-text-muted">No Active Processes Detected</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {processes.map((proc) => (
            <div
              key={proc.id}
              // Card-shaped container, so the full 200px field rather than the
              // tight one the flat ledger rows take.
              data-bloom=""
              className="rounded-xl border border-neon-purple/20 bg-dark-900/50 p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Radio className={`w-4 h-4 ${proc.status === "running" ? "text-neon-green pulse-glow" : "text-ps-text-muted"}`} />
                  <span className="text-sm text-ps-text-primary font-medium truncate">{proc.name}</span>
                </div>
                <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${
                  proc.status === "running" ? "bg-neon-green/10 text-neon-green" : "bg-white/5 text-ps-text-muted"
                }`}>
                  {titleCase(proc.status)}
                </span>
              </div>
              <div className="space-y-1 text-xs font-mono text-ps-text-muted">
                <div className="flex justify-between">
                  <span>Type</span>
                  <span className="text-ps-text-secondary capitalize">{proc.type}</span>
                </div>
                {proc.model !== "unknown" && proc.model !== "gateway" && (
                  <div className="flex justify-between">
                    <span>Model</span>
                    <span className="text-ps-text-secondary">{proc.model}</span>
                  </div>
                )}
                {proc.turns > 0 && (
                  <div className="flex justify-between">
                    <span>Turns</span>
                    <span className="text-ps-text-secondary">{proc.turns}</span>
                  </div>
                )}
                {proc.lastActivity && (
                  <div className="flex justify-between">
                    <span>Last activity</span>
                    <span className="text-ps-text-secondary">{timeAgo(proc.lastActivity)}</span>
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
