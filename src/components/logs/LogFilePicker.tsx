// ═══════════════════════════════════════════════════════════════
// LogFilePicker — the grouped log-file sidebar
//
// It renders the already-filtered list it is handed; the name filter and
// the active selection stay on the page. Presentation only.
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
    // navigates by. The width is the SplitPane's, not this file's (T-0131).
    <aside className="flex w-full flex-col min-h-0">
      <Panel className="flex flex-col gap-2 min-h-0 flex-1 p-3">
        <label className="text-micro font-mono uppercase tracking-wide text-ps-text-muted">
          Log file
        </label>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ps-text-muted" />
          <input
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Filter by name…" aria-label="Log file name filter"
            className="w-full bg-ps-surface-ground/80 border border-ps-edge rounded-ps-md pl-8 pr-2 py-2 text-micro text-ps-text-primary placeholder:text-ps-text-faint font-mono"
          />
        </div>
        <div className="flex-1 min-h-[12rem] max-h-[40vh] lg:max-h-[calc(100vh-280px)] overflow-y-auto space-y-3 pr-1">
          {GROUP_ORDER.map((group) => {
            const items = files.filter((l) => l.group === group);
            if (items.length === 0) return null;
            return (
              <div key={group}>
                <div className="text-micro font-mono uppercase tracking-wider text-ps-text-muted mb-1.5">
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
                        className={`flex items-start gap-2 text-left rounded-ps-md px-2.5 py-2 text-micro font-mono border ${
                          activeLog === log.name
                            ? "bg-neon-cyan/10 text-neon-cyan border-neon-cyan/35"
                            : "border-transparent text-ps-text-muted hover:bg-ps-surface-raised hover:text-ps-text-primary"
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
                          <span className="block text-body text-ps-text-muted mt-0.5">
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
            <p className="text-body text-ps-text-muted py-4 text-center">No matching log files</p>
          )}
        </div>
      </Panel>
    </aside>
  );
}
