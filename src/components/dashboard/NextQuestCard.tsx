// ═══════════════════════════════════════════════════════════════
// NextQuestCard — the dashboard's answer to "what do I do first?"
//
// It replaces FirstRunPanel (T-0111, B17). The old panel derived its own
// four-step checklist from four facts the dashboard happened to have, and it
// went quiet for good once one mission existed, which left an operator two
// days into the product with a board and no next step. The quests ARE the
// first-run checklist, they are proved by events the server already records,
// and there are thirty-two of them, so this card can keep answering the same
// question for as long as there is an answer.
//
// One quest at a time: the first that is not complete, not skipped, and
// attemptable on this host. A card that offered a workflow on an install with
// the Composer switched off would be sending the operator at a locked door;
// /quests is where the locked doors are explained.
//
// Presentational. The page hands it the evaluated progress off the stats poll
// it already makes, the host capabilities, and whether the operator has hidden
// the guide, the same way it hands ProgressLine its stats.
// ═══════════════════════════════════════════════════════════════

"use client";

import Link from "next/link";
import { ArrowRight, ChevronRight, Compass } from "lucide-react";

import type { QuestProgress } from "@/lib/quests/evaluate";
import { QUEST_CHAPTERS, questAvailable, type QuestHostCapabilities } from "@/lib/quests/quest-defs";

export interface NextQuestCardProps {
  /** The evaluated quests, from the dashboard's stats poll. Null while unread. */
  quests: QuestProgress | null | undefined;
  /** What this host can do. Every capability defaults to true while unknown. */
  host: QuestHostCapabilities;
  /** The operator turned the guide off (`guide.hidden`). */
  hidden?: boolean;
  /** Offered as "Hide this guide" when the page can write the preference. */
  onHide?: () => void;
}

export default function NextQuestCard({ quests, host, hidden = false, onHide }: NextQuestCardProps) {
  if (hidden || !quests) return null;

  const next = quests.quests.find((q) => !q.completed && !q.skipped && questAvailable(q, host));
  // Nothing left, or nothing left that this host can attempt: the card has
  // said everything it has to say and gets out of the way.
  if (!next) return null;

  const chapter = QUEST_CHAPTERS.find((c) => c.number === next.chapter);

  return (
    <section
      aria-label="Start here"
      className="rounded-xl border border-neon-cyan/25 bg-dark-900/50 overflow-hidden"
    >
      <div className="flex items-center gap-2 border-b border-white/10 bg-dark-800/50 px-4 py-2">
        <Compass className="h-3.5 w-3.5 text-neon-cyan" />
        <span className="text-xs font-mono uppercase tracking-wider text-ps-text-secondary">
          Start here
        </span>
        <span className="ml-auto font-mono text-xs text-ps-text-muted">
          {quests.completed}/{quests.total}
        </span>
      </div>
      <div className="px-4 py-3">
        {chapter && (
          <div className="text-xs font-mono uppercase tracking-wider text-ps-text-muted">
            Chapter {chapter.number} · {chapter.title}
          </div>
        )}
        <div className="mt-1 text-sm font-semibold text-ps-text-primary">{next.title}</div>
        <p className="mt-1 text-sm text-ps-text-secondary">{next.action}</p>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <Link
            href={next.screen}
            className="inline-flex items-center gap-1.5 rounded-md border border-neon-cyan/30 bg-neon-cyan/10 px-3 py-1 text-xs font-mono text-neon-cyan transition-colors hover:bg-neon-cyan/20"
          >
            Go
            <ArrowRight className="h-3 w-3" />
          </Link>
          <Link
            href="/quests"
            className="inline-flex items-center gap-1 text-xs font-mono text-neon-purple hover:underline"
          >
            All quests
            <ChevronRight className="h-3 w-3" />
          </Link>
          {onHide && (
            <button
              type="button"
              onClick={onHide}
              className="ml-auto text-xs font-mono text-ps-text-muted transition-colors hover:text-ps-text-secondary"
            >
              Hide this guide
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
