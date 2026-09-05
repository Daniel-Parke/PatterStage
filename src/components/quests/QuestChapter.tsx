// ═══════════════════════════════════════════════════════════════
// QuestChapter — one chapter, as a disclosure
//
// `<details>`/`<summary>` rather than a bespoke button and a conditional body.
// It is keyboard-operable and announces its own open state without being told
// to, which is exactly what a hand-rolled accordion keeps forgetting (T-0036),
// and its content stays in the document when it is shut, so a browser find can
// reach a quest the operator has folded away.
//
// Chapter 1 is the one that opens itself, because it is where an install with
// nothing done yet has to start. A chapter with nothing left in it folds away
// even when it IS chapter 1: an accordion held open on finished work is
// pushing the unfinished work off the screen.
// ═══════════════════════════════════════════════════════════════

"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

import QuestRow from "@/components/quests/QuestRow";
import type { QuestChapterState, QuestState } from "@/lib/quests/evaluate";

export interface QuestChapterProps {
  chapter: QuestChapterState;
  /** This chapter's quests, skipped ones included: they still show. */
  quests: QuestState[];
  /** `questAvailable` bound to the host the page read. */
  available: (quest: QuestState) => boolean;
  onSkip?: (id: string) => void;
  onUnskip?: (id: string) => void;
}

export default function QuestChapter({
  chapter,
  quests,
  available,
  onSkip,
  onUnskip,
}: QuestChapterProps) {
  const finished = chapter.total > 0 && chapter.completed === chapter.total;

  return (
    <details
      open={chapter.number === 1 && !finished}
      className="group rounded-xl border border-white/10 bg-dark-900/40"
    >
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 transition-colors hover:bg-white/5">
        <ChevronRight
          className="h-4 w-4 shrink-0 text-ps-text-muted transition-transform group-open:rotate-90"
          aria-hidden="true"
        />
        <h2 className="text-sm font-semibold text-ps-text-primary">{chapter.title}</h2>
        <span className="min-w-0 flex-1 text-xs text-ps-text-secondary">{chapter.blurb}</span>
        <span className="shrink-0 font-mono text-xs text-neon-orange">
          {chapter.completed}/{chapter.total}
        </span>
      </summary>

      <div className="space-y-3 border-t border-white/5 px-4 py-3">
        <ul className="space-y-2">
          {quests.map((quest) => (
            <QuestRow
              key={quest.id}
              quest={quest}
              available={available(quest)}
              onSkip={onSkip}
              onUnskip={onUnskip}
            />
          ))}
        </ul>

        {/*
          Places worth looking, with nothing to prove: a pointer is deliberately
          outside n/N, because counting something nobody can tick would put a
          number on the page that never reaches its own denominator.
        */}
        {chapter.seeAlso && chapter.seeAlso.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-mono text-xs uppercase tracking-wider text-ps-text-muted">
              See also
            </span>
            {chapter.seeAlso.map((pointer) => (
              <Link
                key={pointer.href}
                href={pointer.href}
                className="text-xs text-neon-cyan transition-colors hover:text-white"
              >
                {pointer.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </details>
  );
}
