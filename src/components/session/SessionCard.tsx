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
//
// ONE LINE since T-0124. It was two - a title, then a wrapping line of up
// to seven chips, inside `p-4` - which is a card's rhythm applied to a
// ledger, and it made the list 3,621px of scroll at 77px a row. You come
// to this screen to find one session among hundreds, so the cost of a
// tall row is how many you can see at once.
//
// Nothing was dropped to get there. The eight fields are all still here;
// they sit in COLUMNS rather than wrapping, so the eye can run down one of
// them, and the ones that matter least give way first as the viewport
// narrows rather than pushing the row back to two lines. The trailing
// affordance is one chevron at a fixed right offset: three x positions in
// one list is what makes a list look ragged even when the rows are level.
// ═══════════════════════════════════════════════════════════════

"use client";

import Link from "next/link";
import { ChevronRight, Clock, HardDrive, MessageSquare } from "lucide-react";
import Badge from "@/components/ui/Badge";
import { LedgerRow } from "@/components/dashboard/LedgerRow";
import { LiveDot } from "@/components/ui/LiveDot";
import { timeAgo, formatElapsed, pluralise } from "@/lib/utils";
import { sourceMeta } from "@/components/session/constants";
import { SESSION_STATUS_LABELS } from "@/lib/status-labels";
import { formatSessionTitle } from "@/lib/sessions/session-title";
import type { SessionRecord } from "@/lib/sessions/session-repository";
import { MISSIONS_PATH } from "@/lib/missions/mission-deep-link";

export default function SessionCard({ session }: { session: SessionRecord }) {
  const title = formatSessionTitle(session);
  // Never SOURCE_META[source] ?? SOURCE_META.cli: that badged every source the
  // UI had no word for as CLI (T-0105, D29).
  const meta = sourceMeta(session.source);
  const isActive = session.status === "active";
  const isFailed = session.status === "failed";
  const failureTitle =
    [session.error, session.exitCode !== null && session.exitCode !== undefined ? `exit ${session.exitCode}` : null]
      .filter(Boolean)
      .join(" · ") || SESSION_STATUS_LABELS.failed;

  return (
    // The row used to be an <a> wrapping the whole ledger row, with the mission
    // link inside it: an anchor inside an anchor, which is invalid and which
    // assistive technology resolves however it likes (T-0105, D32). The row is
    // a div now, and the title carries a stretched link that covers it.
    <LedgerRow
      hover
      data-testid="session-row"
      className="group relative flex cursor-pointer items-center gap-3"
    >
      {isActive && <LiveDot />}
      <MessageSquare className="h-4 w-4 shrink-0 text-neon-orange" />
      <h3 className="min-w-0 flex-1 truncate font-semibold text-ps-text-primary">
        <Link
          href={`/results/sessions/${session.id}`}
          className="after:absolute after:inset-0 after:content-['']"
        >
          {title}
        </Link>
      </h3>

      {isFailed && (
        <span title={failureTitle} className="relative z-10 shrink-0">
          <Badge color="red">
            {session.exitCode !== null && session.exitCode !== undefined
              ? `${SESSION_STATUS_LABELS.failed} · exit ${session.exitCode}`
              : SESSION_STATUS_LABELS.failed}
          </Badge>
        </span>
      )}
      {session.missionId && (
        <Link
          href={`${MISSIONS_PATH}?mission=${session.missionId}`}
          className="relative z-10 shrink-0"
          title="Open parent mission"
        >
          <Badge color="green">mission</Badge>
        </Link>
      )}

      {/* The columns, widest-to-narrowest in the order they give way. A fact
          that is useful only when you are already looking closely goes first;
          the age and the source are what you scan a list of sessions BY, so
          they are the last to leave. */}
      {session.profileName && (
        <span className="hidden shrink-0 font-mono text-micro text-ps-text-muted xl:inline">
          {session.profileName}
        </span>
      )}
      {session.modelId && (
        <span className="hidden shrink-0 lg:inline">
          <Badge color="purple">{session.modelId}</Badge>
        </span>
      )}
      {session.size > 0 && (
        <span className="hidden w-20 shrink-0 items-center justify-end gap-1 font-mono text-micro tabular-nums text-ps-text-muted md:flex">
          <HardDrive className="h-3 w-3" />
          {(session.size / 1024).toFixed(1)} KB
        </span>
      )}
      {typeof session.messageCount === "number" && session.messageCount > 0 && (
        <span
          className="hidden w-20 shrink-0 items-center justify-end gap-1 font-mono text-micro tabular-nums text-ps-text-muted sm:flex"
          title={`${session.messageCount} message${pluralise(session.messageCount)}`}
        >
          <MessageSquare className="h-3 w-3" />
          {session.messageCount} msgs
        </span>
      )}
      <span
        className={`flex shrink-0 items-center gap-1 rounded-ps-sm px-1.5 py-0.5 font-mono text-micro ${meta.colorClass}`}
      >
        {meta.icon}
        {meta.label}
      </span>
      <span
        data-testid="session-age"
        className={`w-24 shrink-0 text-right font-mono text-micro tabular-nums ${isActive ? "text-neon-green" : "text-ps-text-muted"}`}
      >
        <Clock className="mr-1 inline h-3 w-3" />
        {isActive ? `${formatElapsed(session.startedAt)} ago` : timeAgo(session.startedAt)}
      </span>

      <ChevronRight
        data-testid="session-open"
        aria-hidden="true"
        className="h-4 w-4 shrink-0 text-ps-viz-glyph-idle transition-all group-hover:translate-x-0.5 group-hover:text-neon-orange"
      />
    </LedgerRow>
  );
}
