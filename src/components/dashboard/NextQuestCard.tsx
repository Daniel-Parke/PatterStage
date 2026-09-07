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
// the guide, the same way it hands ProgressLine its stats. Since U13 (T-0127)
// it is the dashboard's own Panel shell with the header every other panel has,
// and its three controls are the primitives rather than three class strings.
// ═══════════════════════════════════════════════════════════════

"use client";

import { ArrowRight, ChevronRight, Compass } from "lucide-react";

import { Panel, PanelHeader } from "@/components/dashboard/Panel";
import Button from "@/components/ui/Button";
import LinkButton from "@/components/ui/LinkButton";
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
    <section aria-label="Start here">
      <Panel accent="cyan">
        <PanelHeader
          icon={Compass}
          label="Start here"
          accent="cyan"
          rightSlot={
            <span className="font-mono text-micro text-ps-text-muted">
              {quests.completed}/{quests.total}
            </span>
          }
        />
        <div className="px-4 py-3">
          {chapter && (
            <div className="font-mono text-micro uppercase tracking-wider text-ps-text-muted">
              Chapter {chapter.number} · {chapter.title}
            </div>
          )}
          <div className="mt-1 text-body font-semibold text-ps-text-primary">{next.title}</div>
          <p className="mt-1 text-body text-ps-text-secondary">{next.action}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <LinkButton href={next.screen} variant="primary" color="cyan" size="sm" icon={ArrowRight}>
              Go
            </LinkButton>
            <LinkButton href="/quests" variant="ghost" color="purple" size="sm">
              All quests
              <ChevronRight className="h-3 w-3" aria-hidden="true" />
            </LinkButton>
            {onHide && (
              <Button variant="ghost" size="sm" onClick={onHide} className="ml-auto">
                Hide this guide
              </Button>
            )}
          </div>
        </div>
      </Panel>
    </section>
  );
}
