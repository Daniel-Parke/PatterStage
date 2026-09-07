// ═══════════════════════════════════════════════════════════════
// ProcessesPanel — dashboard "Running Hermes Processes" grid
// ═══════════════════════════════════════════════════════════════
//
// Extracted from the dashboard god-page (src/app/page.tsx). Renders the
// process cards (or an empty state) with a manual refresh affordance.
// Computes the "N Active" count internally from the process list.

"use client";

import { sectionHeadingClasses } from "@/lib/theme";
import { useMemo } from "react";
import { Radio, RefreshCw } from "lucide-react";

import { timeAgo, titleCase } from "@/lib/utils";
import { statusToneClasses } from "@/lib/theme";
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
        <h2 className={`${sectionHeadingClasses} flex items-center gap-2`}>
          <Radio className="w-3 h-3 text-neon-purple" />
          Running Hermes Processes
          <span className="text-body text-ps-text-faint ml-1">({activeCount} Active)</span>
        </h2>
        <RefreshCw
          className="w-3 h-3 text-ps-viz-glyph-idle hover:text-ps-text-muted cursor-pointer"
          onClick={onRefresh}
        />
      </div>
      {processes.length === 0 ? (
        <div className="rounded-ps-lg border border-neon-purple/20 bg-ps-surface-panel p-6 text-center">
          <Radio className="w-8 h-8 text-ps-viz-glyph-idle mx-auto mb-2" />
          <div className="text-body text-ps-text-muted">No Active Processes Detected</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {processes.map((proc) => (
            <div
              key={proc.id}
              // Card-shaped container, so the full 200px field rather than the
              // tight one the flat ledger rows take.
              data-bloom=""
              className="rounded-ps-lg border border-neon-purple/20 bg-ps-surface-panel p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Radio className={`w-4 h-4 ${proc.status === "running" ? `${statusToneClasses.running.text} pulse-glow` : statusToneClasses.idle.text}`} />
                  <span className="text-body text-ps-text-primary font-medium truncate">{proc.name}</span>
                </div>
                <span className={`text-micro font-mono px-2 py-0.5 rounded-full ${
                  proc.status === "running"
                    ? `${statusToneClasses.running.fill} ${statusToneClasses.running.text}`
                    : `bg-ps-surface-raised ${statusToneClasses.idle.text}`
                }`}>
                  {titleCase(proc.status)}
                </span>
              </div>
              <div className="space-y-1 text-micro font-mono text-ps-text-muted">
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
