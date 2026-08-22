// ═══════════════════════════════════════════════════════════════
// LogsHeaderActions — the System Logs page-header control cluster
//
// Extracted verbatim from app/(main)/logs/page.tsx: auto-refresh
// toggle, line-count select, Refresh and the two-step Delete All.
// Presentation only; every piece of state stays on the page.
// ═══════════════════════════════════════════════════════════════

"use client";

import { Play, RefreshCw, Trash2 } from "lucide-react";
import Button from "@/components/ui/Button";

export interface LogsHeaderActionsProps {
  autoRefresh: boolean;
  onToggleAutoRefresh: () => void;
  lineCount: number;
  onLineCountChange: (lines: number) => void;
  refreshing: boolean;
  onRefresh: () => void;
  deleteArmed: boolean;
  onDeleteAll: () => void;
  onCancelDelete: () => void;
}

export default function LogsHeaderActions({
  autoRefresh,
  onToggleAutoRefresh,
  lineCount,
  onLineCountChange,
  refreshing,
  onRefresh,
  deleteArmed,
  onDeleteAll,
  onCancelDelete,
}: LogsHeaderActionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onToggleAutoRefresh}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all duration-300 ${
          autoRefresh
            ? "bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/50 shadow-[0_0_8px_rgba(6,214,214,0.3)]"
            : "bg-dark-900/50 text-white/40 border border-white/10 hover:text-white/60"
        } ${autoRefresh ? "animate-auto-refresh-tick" : ""}`}
        title={autoRefresh ? "Auto-refresh on (click to disable)" : "Auto-refresh off (click to enable)"}
      >
        {autoRefresh ? (
          <RefreshCw className={`w-3.5 h-3.5 ${autoRefresh ? "animate-spin-slow" : ""}`} />
        ) : (
          <Play className="w-3.5 h-3.5" />
        )}
      </button>
      <select
        value={lineCount}
        onChange={(e) => {
          // Defensive: `parseInt(value, 10)` returns NaN for empty
          // strings, non-numeric input, or values out of the
          // <select>'s 100/200/500/1000 range. The API route
          // (`src/app/api/logs/route.ts`) handles this with
          // `parseInt(...) + Number.isFinite + Math.min(...,1000) +
          // 200` default — the page mirrors that shape so a future
          // change to a number input (or an empty selection) lands
          // on a stable fallback (200) instead of NaN propagating
          // into the `useLogs` query key. Byte-equivalent for the
          // current <select> (all 4 options pass the `>= 1` and
          // `<= 1000` gates).
          const parsed = parseInt(e.target.value, 10);
          onLineCountChange(Number.isFinite(parsed) && parsed >= 1 ? Math.min(parsed, 1000) : 200);
        }}
        className="bg-dark-900/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white font-mono appearance-none cursor-pointer outline-none focus:border-neon-cyan/50"
      >
        <option value={100} className="bg-dark-900">100 lines</option>
        <option value={200} className="bg-dark-900">200 lines</option>
        <option value={500} className="bg-dark-900">500 lines</option>
        <option value={1000} className="bg-dark-900">1000 lines</option>
      </select>
      <Button
        variant="secondary"
        size="sm"
        onClick={onRefresh}
        loading={refreshing}
        icon={RefreshCw}
      >
        Refresh
      </Button>
      <Button
        variant="danger"
        size="sm"
        onClick={onDeleteAll}
        icon={Trash2}
      >
        {deleteArmed ? "Confirm Clear" : "Delete All"}
      </Button>
      {deleteArmed && (
        <Button variant="ghost" size="sm" onClick={onCancelDelete}>
          Cancel
        </Button>
      )}
    </div>
  );
}
