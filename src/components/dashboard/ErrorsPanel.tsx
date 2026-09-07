// ═══════════════════════════════════════════════════════════════
// ErrorsPanel — dashboard recent-errors panel with severity filter
// ═══════════════════════════════════════════════════════════════
//
// Renders the (already filtered + deduped) error rows with an all/error/warning
// severity selector. The page owns the filter state + dedup memo. Since U13
// (T-0127) the panel's header carries the monitor's count, which used to be a
// pill in the row above saying the same thing 300px away; and the selector is
// a radiogroup, so a screen reader is told which severity is chosen.

"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";

import { Panel, PanelHeader } from "@/components/dashboard/Panel";
import { LedgerRow } from "@/components/dashboard/LedgerRow";
import SegmentedControl from "@/components/ui/SegmentedControl";
import { statusToneClasses } from "@/lib/theme";
import type { MonitorData } from "@/types/console";

type ErrorSeverity = "all" | "error" | "warning";

export interface ErrorsPanelProps {
  /** The filtered + deduped error rows to render. */
  errors: MonitorData["errors"];
  /** The monitor's count before the filter, said in the header. */
  count: number;
  severity: ErrorSeverity;
  onSelectSeverity: (severity: ErrorSeverity) => void;
}

const SEVERITIES = [
  { value: "all", label: "All" },
  { value: "error", label: "Errors" },
  { value: "warning", label: "Warnings" },
] as const;

export default function ErrorsPanel({ errors, count, severity, onSelectSeverity }: ErrorsPanelProps) {
  return (
    <Panel accent="red">
      <PanelHeader
        icon={AlertTriangle}
        label="Errors"
        accent="red"
        count={`${count} recent ${count === 1 ? "error" : "errors"}`}
        rightSlot={<SegmentedControl label="Error severity" options={SEVERITIES} value={severity} onChange={onSelectSeverity} />}
      />
      <div className="max-h-48 overflow-y-auto">
        {errors.length === 0 && (
          <div className="px-4 py-6 text-center">
            <CheckCircle2 className={`mx-auto mb-1 h-5 w-5 ${statusToneClasses.ok.text}`} />
            <div className={`text-body ${statusToneClasses.ok.text}`}>No recent errors</div>
          </div>
        )}
        {errors.map((err) => (
          // Ledger row (WG-WEB-003). Tight field, as on every other row, and
          // now from the shared component rather than from this file (T-0033).
          <LedgerRow
            key={`${err.source}-${err.message}`}
            padding="none"
            className="px-4 py-2 border-b border-ps-edge-hairline last:border-0"
          >
            {/* Truncated to one line with no way to read the rest: these
                messages are frequently a whole JSON tool result, and the part
                that names the failure is past the cut. The title attribute is
                the cheapest way to make the full text reachable. */}
            <div className={`truncate font-mono text-micro ${statusToneClasses.fail.text}`} title={err.message}>
              {err.message}
            </div>
            <div className="mt-0.5 font-mono text-micro text-ps-text-faint">
              {err.source} {err.timestamp && `· ${err.timestamp}`}
            </div>
          </LedgerRow>
        ))}
      </div>
    </Panel>
  );
}
