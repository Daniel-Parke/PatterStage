// ═══════════════════════════════════════════════════════════════
// MissionGroupCard — sessions sharing a missionId, collapsed into one row
//
// Extracted verbatim from app/(main)/sessions/page.tsx. The expanded
// flag is local card state; the grouping itself is computed upstream by
// buildGroupedEntries in src/lib/sessions/sessions-grouping.ts.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Clock, Layers } from "lucide-react";
import { LiveDot } from "@/components/ui/LiveDot";
import { timeAgo } from "@/lib/utils";
import { formatSessionTitle } from "@/lib/sessions/session-title";
import type { MissionGroup } from "@/lib/sessions/sessions-grouping";
import SessionCard from "@/components/session/SessionCard";

export default function MissionGroupCard({ group }: { group: MissionGroup }) {
  const [expanded, setExpanded] = useState(false);
  const hasActive = group.activeCount > 0;
  const oldest = group.sessions[group.sessions.length - 1];
  const latest = group.sessions[0];
  const title = formatSessionTitle(latest);

  return (
    <div className="rounded-xl border border-neon-green/20 bg-neon-green/[0.03] overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 hover:bg-neon-green/[0.04] transition-colors text-left flex items-center justify-between gap-3"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {hasActive && <LiveDot />}
            <Layers className="w-4 h-4 text-neon-green flex-shrink-0" />
            <h3 className="font-semibold text-white truncate">{title}</h3>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neon-green/10 text-neon-green">
              {group.sessions.length} sessions
            </span>
            {hasActive && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neon-green/20 text-neon-green">
                {group.activeCount} active
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-white/30 font-mono flex-wrap">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {timeAgo(group.firstStartedAt)} → {timeAgo(group.lastStartedAt)}
            </span>
            <span>id: {group.missionId.slice(0, 8)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link
            href={`/orchestration/missions/${group.missionId}`}
            onClick={(e) => e.stopPropagation()}
            className="text-[10px] font-mono px-2 py-1 rounded bg-neon-green/10 text-neon-green hover:bg-neon-green/20 transition-colors"
            title="Open the parent mission"
          >
            ↗ Mission
          </Link>
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-white/30" />
          ) : (
            <ChevronRight className="w-4 h-4 text-white/30" />
          )}
        </div>
      </button>
      {expanded && (
        <div className="border-t border-white/5 p-3 space-y-2 bg-dark-900/30">
          {group.sessions.map((s) => (
            <SessionCard key={s.id} session={s} />
          ))}
          {oldest && oldest.id !== latest.id && (
            <p className="text-[10px] font-mono text-white/20 px-2">
              Showing all {group.sessions.length} sessions · oldest: {timeAgo(oldest.startedAt)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
