// ═══════════════════════════════════════════════════════════════
// MissionGroupCard — sessions sharing a missionId, collapsed into one row
//
// Extracted verbatim from app/(main)/sessions/page.tsx. The expanded
// flag is local card state; the grouping itself is computed upstream by
// buildGroupedEntries in src/lib/sessions/sessions-grouping.ts.
//
// T-0033 turned the green rounded box into a ledger row inside the page's
// one Panel, per WG-WEB-003 (D). A group row is still a group: it keeps
// its green wash, its counts and its expansion, and the sessions it opens
// are the same SessionCard rows the ungrouped list renders, divided the
// same way. What went is the second border drawn around a record that was
// already inside a bordered list.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Clock, Layers } from "lucide-react";
import { LiveDot } from "@/components/ui/LiveDot";
import { LedgerRowButton } from "@/components/dashboard/LedgerRow";
import { timeAgo } from "@/lib/utils";
import { formatSessionTitle } from "@/lib/sessions/session-title";
import type { MissionGroup } from "@/lib/sessions/sessions-grouping";
import SessionCard from "@/components/session/SessionCard";
import { MISSIONS_PATH } from "@/lib/missions/mission-deep-link";

export default function MissionGroupCard({ group }: { group: MissionGroup }) {
  const [expanded, setExpanded] = useState(false);
  const hasActive = group.activeCount > 0;
  const oldest = group.sessions[group.sessions.length - 1];
  const latest = group.sessions[0];
  const title = formatSessionTitle(latest);

  return (
    <div className="bg-neon-green/5">
      {/* The Mission link used to live INSIDE this button: an anchor inside a
          button, which is invalid and which assistive technology resolves
          however it likes (T-0105, D32). They are siblings now. */}
      <div className="flex items-center gap-2">
      <LedgerRowButton
        padding="block"
        onClick={() => setExpanded(!expanded)}
        className="flex-1 min-w-0 text-left flex items-center justify-between gap-3"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {hasActive && <LiveDot />}
            <Layers className="w-4 h-4 text-neon-green flex-shrink-0" />
            <h3 className="font-semibold text-white truncate">{title}</h3>
            <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-neon-green/10 text-neon-green">
              {group.sessions.length} on this page
            </span>
            {hasActive && (
              <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-neon-green/20 text-neon-green">
                {group.activeCount} active
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-ps-text-muted font-mono flex-wrap">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {timeAgo(group.firstStartedAt)} → {timeAgo(group.lastStartedAt)}
            </span>
            <span>id: {group.missionId.slice(0, 8)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-ps-text-muted" />
          ) : (
            <ChevronRight className="w-4 h-4 text-ps-text-muted" />
          )}
        </div>
      </LedgerRowButton>
      <Link
        href={`${MISSIONS_PATH}?mission=${group.missionId}`}
        className="mr-4 text-xs font-mono px-2 py-1 rounded bg-neon-green/10 text-neon-green hover:bg-neon-green/20 transition-colors shrink-0"
        title="Open the parent mission"
      >
        ↗ Mission
      </Link>
      </div>
      {expanded && (
        <div className="border-t border-white/5 bg-dark-900/30 divide-y divide-white/5">
          {group.sessions.map((s) => (
            <SessionCard key={s.id} session={s} />
          ))}
          {oldest && oldest.id !== latest.id && (
            <p className="text-xs font-mono text-ps-text-faint px-4 py-2">
              {group.sessions.length} on this page · oldest: {timeAgo(oldest.startedAt)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
