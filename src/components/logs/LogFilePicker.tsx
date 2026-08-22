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
import { GROUP_ORDER, GROUP_LABELS } from "@/components/logs/constants";
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
  return (
    <aside className="w-full lg:w-72 shrink-0 flex flex-col gap-2 min-h-0 border border-white/10 rounded-xl bg-dark-900/40 p-3">
      <label className="text-[10px] font-mono uppercase tracking-wide text-white/40">
        Log file
      </label>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/35" />
        <input
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Filter by name…"
          className="w-full bg-dark-950/80 border border-white/10 rounded-lg pl-8 pr-2 py-2 text-xs text-white placeholder:text-white/25 outline-none focus:border-neon-cyan/40 font-mono"
        />
      </div>
      <div className="flex-1 min-h-[12rem] max-h-[40vh] lg:max-h-[calc(100vh-280px)] overflow-y-auto space-y-3 pr-1">
        {GROUP_ORDER.map((group) => {
          const items = files.filter((l) => l.group === group);
          if (items.length === 0) return null;
          return (
            <div key={group}>
              <div className="text-[10px] font-mono uppercase tracking-wider text-white/35 mb-1.5">
                {GROUP_LABELS[group]}
              </div>
              <div className="flex flex-col gap-1">
                {items.map((log) => (
                  <button
                    key={log.name}
                    type="button"
                    onClick={() => onSelect(log.name)}
                    className={`flex items-start gap-2 text-left rounded-lg px-2.5 py-2 text-xs font-mono border transition-colors ${
                      activeLog === log.name
                        ? "bg-neon-cyan/10 text-neon-cyan border-neon-cyan/35"
                        : "border-transparent text-white/55 hover:bg-white/5 hover:text-white/80"
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5 shrink-0 mt-0.5 opacity-60" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{log.name}.log</span>
                      <span className="block text-[10px] text-white/30 mt-0.5">
                        {formatBytes(log.size)}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        {files.length === 0 && (
          <p className="text-xs text-white/35 py-4 text-center">No matching log files</p>
        )}
      </div>
    </aside>
  );
}
