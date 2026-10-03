// ── ReaderNavigation — prev/next and the second row of chapter dots.
// The dots are the same ChapterDots the header draws, so the two ends of the
// page cannot disagree about what a pending chapter looks like; the bar sits
// on the panel rung, as the header does (U12, T-0126).

"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import Button from "@/components/ui/Button";
import ChapterDots from "@/modules/rec-room/components/ChapterDots";
import type { Chapter } from "@/modules/rec-room/components/story-reader-types";

export interface ReaderNavigationProps {
  chapters: Chapter[];
  currentChapter: number;
  prevChapter: Chapter | null;
  nextChapter: Chapter | null;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onSelectChapter: (num: number) => void;
}

export default function ReaderNavigation({
  chapters,
  currentChapter,
  prevChapter,
  nextChapter,
  hasNext,
  onPrev,
  onNext,
  onSelectChapter,
}: ReaderNavigationProps) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-2 border-t border-ps-edge-hairline bg-ps-surface-panel px-4 py-3 md:px-6">
      <Button variant="ghost" icon={ChevronLeft} onClick={onPrev} disabled={currentChapter <= 1} className="max-w-[45%]" title={prevChapter ? prevChapter.title : "Previous chapter"}>
        <span className="truncate">{prevChapter ? prevChapter.title : "Previous"}</span>
      </Button>

      <ChapterDots
        chapters={chapters}
        currentChapter={currentChapter}
        onSelect={onSelectChapter}
        className="max-w-[200px] overflow-x-auto md:max-w-none"
      />

      <Button variant="ghost" onClick={onNext} disabled={!hasNext} className="max-w-[45%]" title={nextChapter ? nextChapter.title : "Next chapter"}>
        <span className="truncate">{nextChapter ? nextChapter.title : "Next"}</span>
        <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
      </Button>
    </div>
  );
}
