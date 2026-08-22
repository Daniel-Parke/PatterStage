// ═══════════════════════════════════════════════════════════════
// ScriptRow — one *.sh file with its size, schedule and actions
//
// Extracted verbatim from app/orchestration/scripts/page.tsx. Every
// action is a callback; the row owns no state. Presentation only.
// ═══════════════════════════════════════════════════════════════

"use client";

import {
  Terminal, Play, ScrollText, CalendarClock, Loader2, X, FileCode,
} from "lucide-react";
import { timeAgo } from "@/lib/utils";
import type { ScriptFile } from "@/hooks/useScripts";

function fmtSize(n: number): string {
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)}MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)}KB`;
  return `${n}B`;
}

export interface ScriptRowProps {
  script: ScriptFile;
  busy: boolean;
  onRun: (s: ScriptFile) => void;
  onEdit: (s: ScriptFile) => void;
  onLogs: (s: ScriptFile) => void;
  onSchedule: (s: ScriptFile) => void;
  onUnschedule: (s: ScriptFile) => void;
}

export default function ScriptRow({
  script: s,
  busy,
  onRun,
  onEdit,
  onLogs,
  onSchedule,
  onUnschedule,
}: ScriptRowProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-dark-900/30 px-4 py-3">
      <Terminal className="h-4 w-4 shrink-0 text-neon-cyan" />
      <div className="min-w-0 flex-1">
        <div className="truncate font-mono text-sm text-white/85">{s.name}</div>
        <div className="truncate font-mono text-[11px] text-white/35">
          {fmtSize(s.size)}
          {" · "}
          {s.schedule ? <span className="text-neon-orange/80">{s.schedule}</span> : "not scheduled"}
          {s.lastRun ? ` · last run ${timeAgo(s.lastRun)}` : ""}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onRun(s)}
        disabled={busy}
        className="flex items-center gap-1 rounded-lg border border-neon-green/30 px-2.5 py-1 font-mono text-[11px] text-neon-green hover:bg-neon-green/10 disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />} Run
      </button>
      <button
        type="button"
        onClick={() => onEdit(s)}
        className="flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1 font-mono text-[11px] text-white/60 hover:bg-white/5"
      >
        <FileCode className="h-3 w-3" /> Edit
      </button>
      <button
        type="button"
        onClick={() => onLogs(s)}
        className="flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1 font-mono text-[11px] text-white/60 hover:bg-white/5"
      >
        <ScrollText className="h-3 w-3" /> Logs
      </button>
      {s.schedule ? (
        <button
          type="button"
          onClick={() => onUnschedule(s)}
          className="flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1 font-mono text-[11px] text-white/50 hover:bg-white/5"
        >
          <X className="h-3 w-3" /> Unschedule
        </button>
      ) : (
        <button
          type="button"
          onClick={() => onSchedule(s)}
          className="flex items-center gap-1 rounded-lg border border-neon-orange/30 px-2.5 py-1 font-mono text-[11px] text-neon-orange hover:bg-neon-orange/10"
        >
          <CalendarClock className="h-3 w-3" /> Schedule
        </button>
      )}
    </div>
  );
}
