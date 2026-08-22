// ═══════════════════════════════════════════════════════════════
// LogTerminal — the terminal-styled log pane
//
// Extracted verbatim from app/(main)/logs/page.tsx: chrome bar,
// column headings and the rendered rows. The scroll container ref and
// the scroll handler stay with the page, which owns auto-scroll.
// Presentation only.
// ═══════════════════════════════════════════════════════════════

"use client";

import type { RefObject } from "react";
import { LogRow } from "@/components/logs/LogRow";

export interface LogTerminalProps {
  containerRef: RefObject<HTMLDivElement | null>;
  onScroll: () => void;
  logName: string;
  activeLog: string;
  showingLines: number;
  totalLines: number;
  lines: string[];
  searchTerm: string;
}

export default function LogTerminal({
  containerRef,
  onScroll,
  logName,
  activeLog,
  showingLines,
  totalLines,
  lines,
  searchTerm,
}: LogTerminalProps) {
  return (
    <div
      ref={containerRef}
      onScroll={onScroll}
      className="rounded-xl border border-white/10 bg-dark-900/50 overflow-hidden flex flex-col flex-1 min-h-0"
    >
      <div className="flex items-center gap-2 px-4 py-2 border-b border-white/10 bg-dark-800/50 shrink-0">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/80" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
          <div className="w-3 h-3 rounded-full bg-green-500/80" />
        </div>
        <span className="text-xs text-white/40 font-mono ml-2 truncate">
          {activeLog}.log
          <span className="text-white/20 ml-2">
            (showing {showingLines}/{totalLines})
          </span>
        </span>
      </div>

      <div className="px-3 py-2 border-b border-white/5 bg-dark-950/30 shrink-0 hidden sm:grid sm:grid-cols-[minmax(0,9.5rem)_minmax(0,4.5rem)_1fr] gap-x-3 text-[10px] font-mono uppercase tracking-wide text-white/30">
        <span>Time</span>
        <span>Level</span>
        <span>Message</span>
      </div>

      <div className="p-3 sm:p-4 text-xs overflow-auto flex-1 min-h-0 max-h-[calc(100vh-320px)] lg:max-h-none">
        {lines.length > 0 ? (
          lines.map((line, i) => (
            <LogRow
              key={`${logName}-${i}`}
              line={line}
              searchTerm={searchTerm}
            />
          ))
        ) : (
          <div className="text-center text-white/20 py-8">
            {searchTerm ? "No matching lines" : "Log file is empty"}
          </div>
        )}
      </div>
    </div>
  );
}
