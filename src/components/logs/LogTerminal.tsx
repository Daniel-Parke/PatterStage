// ═══════════════════════════════════════════════════════════════
// LogTerminal — the terminal-styled log pane
//
// Chrome bar, column headings and the rendered rows. The scroll container ref
// and the scroll handler stay with the page, which owns auto-scroll.
// Presentation only.
//
// THE REF GOES ON THE DIV THAT SCROLLS. It used to go on <Panel>, whose outer
// div carries overflow-hidden, while the element that actually scrolls is the
// inner overflow-auto one below. So scrollTop was permanently 0: the page's
// auto-scroll effect wrote 0 to a div that could not move, its scroll handler
// never fired, autoScroll never turned off, and the "Latest lines" pill that
// appears only when it does could therefore never appear at all (T-0101, D59).
// ═══════════════════════════════════════════════════════════════

"use client";

import type { RefObject } from "react";
import { LogRow } from "@/components/logs/LogRow";
import { Panel } from "@/components/dashboard/Panel";

export interface LogTerminalProps {
  /** Points at the element that scrolls, which is the inner one. */
  scrollRef: RefObject<HTMLDivElement | null>;
  onScroll: () => void;
  logName: string;
  activeLog: string;
  showingLines: number;
  totalLines: number;
  lines: string[];
  searchTerm: string;
}

export default function LogTerminal({
  scrollRef,
  onScroll,
  logName,
  activeLog,
  showingLines,
  totalLines,
  lines,
  searchTerm,
}: LogTerminalProps) {
  return (
    // The shell was a hand-rolled copy of Panel down to the class list:
    // rounded-xl, border-white/10, bg-dark-900/50, overflow-hidden. It is the
    // Panel now (T-0033). It takes no ref and no scroll handler: it is the box,
    // not the scroller.
    <Panel className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-white/10 bg-dark-800/50 shrink-0">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/80" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
          <div className="w-3 h-3 rounded-full bg-green-500/80" />
        </div>
        <span className="text-xs text-ps-text-muted font-mono ml-2 truncate">
          {activeLog}.log
          <span className="text-ps-text-faint ml-2">
            (showing {showingLines}/{totalLines})
          </span>
        </span>
      </div>

      <div className="px-3 py-2 border-b border-white/5 bg-dark-950/30 shrink-0 hidden sm:grid sm:grid-cols-[minmax(0,9.5rem)_minmax(0,4.5rem)_1fr] gap-x-3 text-xs font-mono uppercase tracking-wide text-ps-text-muted">
        <span>Time</span>
        <span>Level</span>
        <span>Message</span>
      </div>

      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="p-3 sm:p-4 text-xs overflow-auto flex-1 min-h-0 max-h-[calc(100vh-320px)] lg:max-h-none"
      >
        {lines.length > 0 ? (
          lines.map((line, i) => (
            <LogRow
              key={`${logName}-${i}`}
              line={line}
              searchTerm={searchTerm}
            />
          ))
        ) : (
          <div className="text-center text-ps-text-faint py-8">
            {searchTerm ? "No matching lines" : "Log file is empty"}
          </div>
        )}
      </div>
    </Panel>
  );
}
