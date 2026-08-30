// ── MobileChapterDrawer — the chapter list as a small-screen overlay.
// Extracted verbatim from app/recroom/story-weaver/[id]/page.tsx.

"use client";

import { X } from "lucide-react";
import ChapterList from "@/modules/rec-room/components/ChapterList";
import type { Chapter, ReaderTheme } from "@/modules/rec-room/components/story-reader-types";

export default function MobileChapterDrawer({
  chapters,
  currentChapter,
  theme,
  onClose,
  onSelect,
}: {
  chapters: Chapter[];
  currentChapter: number;
  theme: ReaderTheme;
  onClose: () => void;
  onSelect: (num: number) => void;
}) {
  return (
    <div className="lg:hidden fixed inset-0 z-40 bg-dark-950/80 backdrop-blur-sm" onClick={onClose}>
      <div className="absolute left-0 top-0 bottom-0 w-72 border-r border-white/10 overflow-y-auto" style={{ background: theme.panel }}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end p-3">
          <button onClick={onClose} aria-label="Close chapter list"
            className="p-2 rounded-lg text-ps-text-muted hover:text-ps-text-secondary hover:bg-white/5 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-3 pb-4">
          <ChapterList chapters={chapters} currentChapter={currentChapter} onSelect={onSelect} />
        </div>
      </div>
    </div>
  );
}
