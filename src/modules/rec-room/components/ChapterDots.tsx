// ── ChapterDots — the row of chapter dots the reader shows twice.
//
// ReaderHeader and ReaderNavigation each drew this row, each 8px dots that
// were the chapter's only visible progress and, at 8px, under a third of the
// 24px target WCAG 2.5.8 asks. One component now, one 24px target per chapter
// with the dot inside it, painted from the status ladder (T-0126).

"use client";

import { statusToneClasses } from "@/lib/ui/theme";
import { chapterTone } from "@/modules/rec-room/lib/chapter-tone";
import type { Chapter } from "@/modules/rec-room/components/story-reader-types";

export interface ChapterDotsProps {
  chapters: Chapter[];
  currentChapter: number;
  onSelect: (num: number) => void;
  /** A title per dot. The header's row has them; the footer's row, drawn a screen below the same chapters, does not. */
  withTitles?: boolean;
  className?: string;
}

export default function ChapterDots({ chapters, currentChapter, onSelect, withTitles = false, className = "" }: ChapterDotsProps) {
  return (
    <div role="group" aria-label="Chapters" className={`flex items-center ${className}`.trim()}>
      {chapters.map((ch, i) => {
        const number = i + 1;
        const current = number === currentChapter;
        const tone = chapterTone(ch);
        const canOpen = ch.status === "complete";
        const name = `Chapter ${number}${ch.title ? `: ${ch.title}` : ""} (${ch.status})`;
        return (
          // design-lint-disable-next-line no-raw-control-outside-ui -- a chapter dot is a 24px target whose coloured fill IS its meaning; no primitive draws one, and wrapping it in Button would put a chrome around a dot
          <button
            key={number}
            type="button"
            onClick={() => canOpen && onSelect(number)}
            disabled={!canOpen}
            aria-label={name}
            aria-current={current ? "true" : undefined}
            title={withTitles ? name : undefined}
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-opacity disabled:cursor-default ${
              statusToneClasses[tone].text
            } ${current ? "" : "opacity-60 hover:opacity-100"}`}
          >
            <span
              aria-hidden="true"
              className={`block rounded-full bg-current ${current ? "h-3 w-3 ring-2 ring-neon-purple" : "h-2 w-2"} ${
                tone === "running" ? "animate-pulse" : ""
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}
