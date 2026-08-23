// ═══════════════════════════════════════════════════════════════
// ErrorsPanel — dashboard recent-errors panel with severity filter
// ═══════════════════════════════════════════════════════════════
//
// Extracted from the dashboard god-page (src/app/page.tsx). Renders
// the (already filtered + deduped) error rows with an all/error/warning
// severity selector. The page owns the filter state + dedup memo.

"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";

import { Panel, PanelHeader } from "@/components/dashboard/Panel";
import { titleCase } from "@/lib/utils";
import type { MonitorData } from "@/types/console";

type ErrorSeverity = "all" | "error" | "warning";

export interface ErrorsPanelProps {
  /** The filtered + deduped error rows to render. */
  errors: MonitorData["errors"];
  severity: ErrorSeverity;
  onSelectSeverity: (severity: ErrorSeverity) => void;
}

const SEVERITIES: readonly ErrorSeverity[] = ["all", "error", "warning"];

export default function ErrorsPanel({ errors, severity, onSelectSeverity }: ErrorsPanelProps) {
  return (
    <Panel accent="red">
      <PanelHeader
        icon={AlertTriangle}
        label="Errors"
        accent="red"
        rightSlot={
          <div className="flex items-center gap-1">
            {SEVERITIES.map((sev) => (
              <button
                key={sev}
                onClick={() => onSelectSeverity(sev)}
                className={`text-xs font-mono px-1.5 py-0.5 rounded transition-colors ${
                  severity === sev ? "bg-red-500/20 text-red-400" : "text-ps-text-muted hover:text-ps-text-secondary"
                }`}
              >
                {titleCase(sev)}
              </button>
            ))}
          </div>
        }
      />
      <div className="max-h-48 overflow-y-auto">
        {errors.length === 0 && (
          <div className="px-4 py-6 text-center">
            <CheckCircle2 className="w-5 h-5 text-neon-green mx-auto mb-1" />
            <div className="text-xs text-neon-green">No recent errors</div>
          </div>
        )}
        {errors.map((err) => (
          <div key={`${err.source}-${err.message}`} className="px-4 py-2 border-b border-white/5 last:border-0">
            {/* Truncated to one line with no way to read the rest: these
                messages are frequently a whole JSON tool result, and the part
                that names the failure is past the cut. The title attribute is
                the cheapest way to make the full text reachable. */}
            <div className="text-xs text-red-400/80 font-mono truncate" title={err.message}>
              {err.message}
            </div>
            <div className="text-xs text-ps-text-faint font-mono mt-0.5">
              {err.source} {err.timestamp && `· ${err.timestamp}`}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
