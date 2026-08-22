// ── ReaderNavigation — prev/next and the second row of chapter dots.
// Extracted verbatim from app/recroom/story-weaver/[id]/page.tsx. Story
// Weaver behaviour is out of scope for T-0011, so the disabled rules and
// the dot colour ladder are copied unchanged.

"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Chapter, ReaderTheme } from "@/modules/rec-room/components/story-reader-types";

export interface ReaderNavigationProps {
  chapters: Chapter[];
  currentChapter: number;
  prevChapter: Chapter | null;
  nextChapter: Chapter | null;
  hasNext: boolean;
  theme: ReaderTheme;
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
  theme,
  onPrev,
  onNext,
  onSelectChapter,
}: ReaderNavigationProps) {
  return (
    <div className="flex items-center justify-between px-4 md:px-6 py-3 border-t flex-shrink-0" style={{ borderColor: theme.rule, background: theme.panel }}>
      <button onClick={onPrev}
        disabled={currentChapter <= 1}
        className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-mono disabled:opacity-20 min-h-[44px] max-w-[45%] truncate"
        style={{ color: theme.text, opacity: 0.6 }}>
        <ChevronLeft className="w-4 h-4 flex-shrink-0" />
        <span className="truncate">{prevChapter ? prevChapter.title : "Prev"}</span>
      </button>

      <div className="flex gap-1.5 overflow-x-auto max-w-[200px] md:max-w-none">
        {chapters.map((ch, i) => (
          <button key={i} onClick={() => ch.status === "complete" && onSelectChapter(i + 1)}
            className={`w-2.5 h-2.5 rounded-full transition-all flex-shrink-0 ${i + 1 === currentChapter ? "scale-125" : "opacity-40 hover:opacity-70"}`}
            style={{ background: ch.status === "complete" ? (i + 1 === currentChapter ? theme.accent : "#4a3f35") : ch.status === "writing" ? "#3b82f6" : ch.status === "pending" ? "#f59e0b" : ch.status === "failed" ? "#7f1d1d" : "#2a2520" }} />
        ))}
      </div>

      <button onClick={onNext}
        disabled={!hasNext}
        className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-mono disabled:opacity-20 min-h-[44px] max-w-[45%] truncate"
        style={{ color: theme.text }}>
        <span className="truncate">{nextChapter ? nextChapter.title : "Next"}</span>
        <ChevronRight className="w-4 h-4 flex-shrink-0" />
      </button>
    </div>
  );
}
