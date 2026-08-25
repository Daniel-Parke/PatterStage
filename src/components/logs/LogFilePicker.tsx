// ═══════════════════════════════════════════════════════════════
// LogFilePicker — the grouped log-file sidebar
//
// Extracted verbatim from app/(main)/logs/page.tsx. It renders the
// already-filtered list it is handed; the name filter and the active
// selection stay on the page. Presentation only.
// ═══════════════════════════════════════════════════════════════

"use client";

import { FileText, Search } from "lucide-react";
import { formatBytes } from "@/lib/utils";
import { formatLogAge, isLogLive } from "@/lib/log-freshness";
import { GROUP_ORDER, GROUP_LABELS } from "@/components/logs/constants";
import { Panel } from "@/components/dashboard/Panel";
import { LedgerRowButton } from "@/components/dashboard/LedgerRow";
import type { LogFileMeta } from "@/lib/fs/log-files";

export interface LogFilePickerProps {
  files: LogFileMeta[];
  query: string;
  onQueryChange: (value: string) => void;
  activeLog: string;
  onSelect: (name: string) => void;
}

export default function LogFilePicker({
  files,
  query,
  onQueryChange,
  activeLog,
  onSelect,
}: LogFilePickerProps) {
  // One clock reading for the whole sidebar. Each file's mtime already
  // arrives with the listing; without it every row read as a size and the
  // operator had no way to spot which log is the one currently moving.
  /* eslint-disable-next-line react-hooks/purity -- freshness is a wall-clock fact; the page refetches this listing every 5s */
  const renderedAt = Date.now();
  return (
    // The aside is layout now and the Panel is the surface (T-0033). It used
    // to draw its own border, radius and interior, which is the box Panel
    // already renders; keeping the <aside> keeps the landmark a screen reader
    // navigates by.
    <aside className="w-full lg:w-72 shrink-0 flex flex-col min-h-0">
      <Panel className="flex flex-col gap-2 min-h-0 flex-1 p-3">
        <label className="text-xs font-mono uppercase tracking-wide text-ps-text-muted">
          Log file
        </label>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ps-text-muted" />
          <input
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Filter by name…"
            className="w-full bg-dark-950/80 border border-white/10 rounded-lg pl-8 pr-2 py-2 text-xs text-white placeholder:text-ps-text-faint outline-none focus:border-neon-cyan/40 font-mono"
          />
        </div>
        <div className="flex-1 min-h-[12rem] max-h-[40vh] lg:max-h-[calc(100vh-280px)] overflow-y-auto space-y-3 pr-1">
          {GROUP_ORDER.map((group) => {
            const items = files.filter((l) => l.group === group);
            if (items.length === 0) return null;
            return (
              <div key={group}>
                <div className="text-xs font-mono uppercase tracking-wider text-ps-text-muted mb-1.5">
                  {GROUP_LABELS[group]}
                </div>
                <div className="flex flex-col gap-1">
                  {items.map((log) => {
                    const age = formatLogAge(log.modified, renderedAt);
                    const live = isLogLive(log.modified, renderedAt);
                    return (
                      <LedgerRowButton
                        key={log.name}
                        padding="none"
                        // This row paints its own selected and unselected states,
                        // including its own hover, so it stands the shared wash
                        // down rather than fighting it: two hover:bg-* classes
                        // resolve by stylesheet order, not attribute order.
                        hover={false}
                        onClick={() => onSelect(log.name)}
                        className={`flex items-start gap-2 text-left rounded-lg px-2.5 py-2 text-xs font-mono border ${
                          activeLog === log.name
                            ? "bg-neon-cyan/10 text-neon-cyan border-neon-cyan/35"
                            : "border-transparent text-ps-text-muted hover:bg-white/5 hover:text-ps-text-primary"
                        }`}
                      >
                        <FileText className="w-3.5 h-3.5 shrink-0 mt-0.5 opacity-60" />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="truncate">{log.name}.log</span>
                            {live && (
                              <span
                                className="w-1.5 h-1.5 rounded-full bg-neon-green shrink-0"
                                title="Written to in the last minute"
                              />
                            )}
                          </span>
                          <span className="block text-xs text-ps-text-muted mt-0.5">
                            {formatBytes(log.size)}
                            {age ? ` · ${age} ago` : ""}
                          </span>
                        </span>
                      </LedgerRowButton>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {files.length === 0 && (
            <p className="text-xs text-ps-text-muted py-4 text-center">No matching log files</p>
          )}
        </div>
      </Panel>
    </aside>
  );
}
