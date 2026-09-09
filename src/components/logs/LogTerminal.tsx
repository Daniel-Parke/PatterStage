// ═══════════════════════════════════════════════════════════════
// LogTerminal — the terminal-styled log pane
//
// Chrome bar, column headings and the rendered rows. The scroll container ref
// and the scroll handler stay with the page, which owns auto-scroll.
// Presentation only.
//
// AND IT IS BOUNDED AT EVERY WIDTH. `lg:max-h-none` let the pane grow past the
// viewport on a wide screen, so the PAGE scrolled and the pane never did: the
// ref would have been on the right element and still read a scrollTop of 0.
// Found on the T-0101 proof walk, at 1280x900, with the fix already in.
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
import { useId } from "react";
import { InlineToggle } from "@/components/ui/Input";
import { InlineSelect } from "@/components/ui/Select";

const LINE_COUNTS = [100, 200, 500, 1000].map((n) => ({ value: String(n), label: `${n} lines` }));

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
  /**
   * The terminal's own bar: whether it refreshes itself, and how much of the
   * file it loads. These sat in the page header until T-0133, where on a
   * phone they wrapped the header onto three rows; they are about the
   * terminal, so they are the terminal's.
   */
  autoRefresh: boolean;
  onToggleAutoRefresh: () => void;
  lineCount: number;
  onLineCountChange: (lines: number) => void;
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
  autoRefresh,
  onToggleAutoRefresh,
  lineCount,
  onLineCountChange,
}: LogTerminalProps) {
  const refreshLabelId = useId();
  return (
    // The shell was a hand-rolled copy of Panel down to the class list:
    // rounded-xl, border-ps-edge-hairline, bg-ps-surface-panel, overflow-hidden. It is the
    // Panel now (T-0033). It takes no ref and no scroll handler: it is the box,
    // not the scroller.
    <Panel className="flex flex-col flex-1 min-h-0">
      {/* The bar names the file and holds the terminal's two controls. It
          drew three coloured dots first, a window-chrome decoration; the
          product's convention is no decoration that is not information
          (the review of 2026-09-08, P4, taken with T-0133). */}
      {/* On the panel's own fill, not raised: the select's edge measured 2.04:1
          against the raised strip and 3:1 against the panel, and the rule
          under the bar is what separates it (the census, T-0133). */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 border-b border-ps-edge-hairline shrink-0">
        <span className="min-w-0 flex-1 truncate text-micro text-ps-text-muted font-mono">
          {activeLog}.log
          <span className="text-ps-text-faint ml-2">
            (showing {showingLines}/{totalLines})
          </span>
        </span>
        <div className="flex items-center gap-2">
          <span id={refreshLabelId} className="text-micro font-mono text-ps-text-muted">
            Auto-refresh
          </span>
          <InlineToggle value={autoRefresh} onChange={onToggleAutoRefresh} color="cyan" labelledBy={refreshLabelId} />
        </div>
        <InlineSelect
          ariaLabel="Lines to show"
          value={String(lineCount)}
          options={LINE_COUNTS}
          onChange={(v) => {
            // The API route clamps to 1..1000 with a 200 default; the same
            // shape here, so a value outside the options lands on 200.
            const parsed = parseInt(v, 10);
            onLineCountChange(Number.isFinite(parsed) && parsed >= 1 ? Math.min(parsed, 1000) : 200);
          }}
        />
      </div>

      <div className="px-3 py-2 border-b border-ps-edge-hairline bg-ps-surface-ground/30 shrink-0 hidden sm:grid sm:grid-cols-[minmax(0,9.5rem)_minmax(0,4.5rem)_1fr] gap-x-3 text-micro font-mono uppercase tracking-wide text-ps-text-muted">
        <span>Time</span>
        <span>Level</span>
        <span>Message</span>
      </div>

      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="p-3 sm:p-4 text-body overflow-auto flex-1 min-h-0 max-h-[calc(100vh-320px)]"
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
