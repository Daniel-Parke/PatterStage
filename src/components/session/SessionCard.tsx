// ═══════════════════════════════════════════════════════════════
// SessionCard — one session as a ledger row
//
// Extracted verbatim from app/(main)/sessions/page.tsx so the page
// stays a thin shell (docs/CONTRIBUTING.md, "Where UI lives").
// Presentation only: it derives its title and source badge from the
// record it is handed and owns no state.
//
// It rendered a rounded box of its own until T-0033. A session record
// carries eight comparable fields (age, source, profile, model, message
// count, size, parent mission, live state), which is what WG-WEB-003 (D)
// rules is a ledger rather than a box: the fields line up down the page
// and the page's Panel is the one container around the lot. The name is
// left alone because nothing about the component's contract changed and
// a rename would churn every import for no reader's benefit.
// ═══════════════════════════════════════════════════════════════

"use client";

import Link from "next/link";
import { ChevronRight, Clock, HardDrive, MessageSquare } from "lucide-react";
import Badge from "@/components/ui/Badge";
import { LedgerRow } from "@/components/dashboard/LedgerRow";
import { LiveDot } from "@/components/ui/LiveDot";
import { timeAgo, formatElapsed, pluralise } from "@/lib/utils";
import { SOURCE_META } from "@/components/session/constants";
import { formatSessionTitle } from "@/lib/sessions/session-title";
import type { SessionRecord } from "@/lib/sessions/session-repository";
import { MISSIONS_PATH } from "@/lib/missions/mission-deep-link";

export default function SessionCard({ session }: { session: SessionRecord }) {
  const title = formatSessionTitle(session);
  const meta = SOURCE_META[session.source] ?? SOURCE_META.cli;
  const isActive = session.status === "active";

  return (
    <Link href={`/sessions/${session.id}`}>
      <LedgerRow hover padding="block" className="group cursor-pointer">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {isActive && <LiveDot />}
              <MessageSquare className="w-4 h-4 text-neon-orange flex-shrink-0" />
              <h3 className="font-semibold text-white truncate">{title}</h3>
            </div>
            <div className="flex items-center gap-3 text-xs text-ps-text-muted font-mono flex-wrap">
              <span
                className={`flex items-center gap-1 ${isActive ? "text-neon-green" : ""}`}
              >
                <Clock className="w-3 h-3" />
                {isActive ? `${formatElapsed(session.startedAt)} ago` : timeAgo(session.startedAt)}
              </span>
              <span className="flex items-center gap-1">
                <span
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-mono ${meta.colorClass}`}
                >
                  {meta.icon}
                  {meta.label}
                </span>
              </span>
              {session.profileName && (
                <span className="text-ps-text-muted">{session.profileName}</span>
              )}
              {session.modelId && <Badge color="purple">{session.modelId}</Badge>}
              {typeof session.messageCount === "number" && session.messageCount > 0 && (
                <span
                  className="flex items-center gap-1 text-ps-text-muted"
                  title={`${session.messageCount} message${pluralise(session.messageCount)}`}
                >
                  <MessageSquare className="w-3 h-3" />
                  {session.messageCount} msgs
                </span>
              )}
              {session.size > 0 && (
                <span className="flex items-center gap-1">
                  <HardDrive className="w-3 h-3" />
                  {(session.size / 1024).toFixed(1)} KB
                </span>
              )}
              {session.missionId && (
                <Link
                  href={`${MISSIONS_PATH}?mission=${session.missionId}`}
                  onClick={(e) => e.stopPropagation()}
                  className="z-10"
                  title="Open parent mission"
                >
                  <Badge color="green">mission</Badge>
                </Link>
              )}
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-neon-orange group-hover:translate-x-0.5 transition-all flex-shrink-0 ml-4" />
        </div>
      </LedgerRow>
    </Link>
  );
}
