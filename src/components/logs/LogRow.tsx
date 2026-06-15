// ═══════════════════════════════════════════════════════════════
// LogRow — Parsed and highlighted log line display component
// ═══════════════════════════════════════════════════════════════

import type { ReactNode } from "react";
import { parseLogLine } from "@/lib/log-line-format";
import { LEVEL_TEXT_CLASS } from "./constants";

/**
 * Highlight search term matches within text.
 */
function highlightText(text: string, searchTerm: string): ReactNode {
  if (!searchTerm) return text;
  const idx = text.toLowerCase().indexOf(searchTerm.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span className="bg-neon-cyan/20 text-neon-cyan">{text.slice(idx, idx + searchTerm.length)}</span>
      {text.slice(idx + searchTerm.length)}
    </>
  );
}

/**
 * Single log line row — parses the line and renders timestamp, level, and
 * message columns with optional search-term highlighting.
 */
export function LogRow({
  line,
  searchTerm,
}: {
  line: string;
  searchTerm: string;
}) {
  const p = parseLogLine(line);
  // The parent's filteredLines pre-filters by search term,
  // so every rendered LogRow is already a match when search is active.
  const isMatch = !!searchTerm;
  return (
    <div
      className={`grid grid-cols-1 sm:grid-cols-[minmax(0,9.5rem)_minmax(0,4.5rem)_1fr] gap-x-3 gap-y-0.5 items-baseline text-xs font-mono py-1.5 border-b border-white/[0.06] ${
        isMatch ? "bg-neon-cyan/5 -mx-2 px-2 rounded" : ""
      }`}
    >
      <span className="text-neon-cyan/45 truncate tabular-nums">{p.timestamp ?? "—"}</span>
      <span className={`uppercase tracking-wide text-[10px] ${LEVEL_TEXT_CLASS[p.level] ?? LEVEL_TEXT_CLASS.unknown}`}>
        {p.level}
      </span>
      <span className={`min-w-0 break-words ${LEVEL_TEXT_CLASS[p.level] ?? LEVEL_TEXT_CLASS.unknown}`}>
        {highlightText(p.message, searchTerm)}
      </span>
    </div>
  );
}