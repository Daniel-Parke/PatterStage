// ── ReaderHeader — the sticky reader bar and the chapter indicator dots.
// Extracted verbatim from app/recroom/story-weaver/[id]/page.tsx. Story
// Weaver behaviour is out of scope for T-0011, so the dot colour ladder,
// the conditional Continue/Retry buttons and the settings slot are copied
// unchanged; every action is a callback back to the page.

"use client";

import { BookMarked, BookOpen, ChevronLeft, PlayCircle, RefreshCw } from "lucide-react";
import ReaderSettings, { type ReadingSettings } from "@/modules/rec-room/components/ReaderSettings";
import { chapterDotColor } from "@/modules/rec-room/components/chapter-dot";
import type { Chapter, ReaderTheme } from "@/modules/rec-room/components/story-reader-types";

export interface ReaderHeaderProps {
  title: string;
  chapters: Chapter[];
  currentChapter: number;
  theme: ReaderTheme;
  allComplete: boolean;
  anyFailed: boolean;
  sidebarOpen: boolean;
  settings: ReadingSettings;
  onSettingsChange: (settings: ReadingSettings) => void;
  onBack: () => void;
  onContinue: () => void;
  onRetryFailed: () => void;
  onOpenBible: () => void;
  onToggleSidebar: () => void;
  onSelectChapter: (num: number) => void;
}

export default function ReaderHeader({
  title,
  chapters,
  currentChapter,
  theme,
  allComplete,
  anyFailed,
  sidebarOpen,
  settings,
  onSettingsChange,
  onBack,
  onContinue,
  onRetryFailed,
  onOpenBible,
  onToggleSidebar,
  onSelectChapter,
}: ReaderHeaderProps) {
  return (
    <div className="sticky top-0 lg:top-0 z-30 border-b border-white/10 bg-dark-950/95 backdrop-blur-xl flex-shrink-0">
      <div className="flex items-center justify-between px-3 md:px-6 min-h-[var(--ps-shell-header-min-height)]">
        <button onClick={onBack}
          className="p-2.5 rounded-lg text-ps-text-muted hover:text-ps-text-secondary hover:bg-white/5 transition-colors flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0 mx-2 text-center">
          <div className="text-xs font-mono text-ps-text-faint uppercase tracking-wider">Story Weaver</div>
          <h1 className="text-sm font-semibold text-white truncate">{title}</h1>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Continue button for complete stories */}
          {allComplete && (
            <button onClick={onContinue}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-green-500/20 text-xs font-bold text-green-400 hover:bg-green-500/10 transition-colors min-h-[44px]"
              title="Continue this story">
              <PlayCircle className="w-4 h-4" />
              <span className="hidden md:inline">Continue</span>
            </button>
          )}
          {/* Retry all failed chapters */}
          {anyFailed && (
            <button onClick={onRetryFailed}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-orange-500/20 text-xs font-bold text-orange-400 hover:bg-orange-500/10 transition-colors min-h-[44px]"
              title="Retry failed chapters">
              <RefreshCw className="w-4 h-4" />
              <span className="hidden md:inline">Retry</span>
            </button>
          )}
          <button onClick={onOpenBible}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-neon-purple/20 text-xs font-bold text-neon-purple hover:text-neon-purple hover:bg-neon-purple/10 transition-colors min-w-[44px] min-h-[44px] justify-center"
            title="Story Bible — arc, plot points & character journeys">
            <BookMarked className="w-4 h-4" />
            <span className="hidden md:inline">Bible</span>
          </button>
          <button onClick={onToggleSidebar}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/10 text-xs font-bold text-ps-text-secondary hover:text-white hover:bg-white/5 transition-colors min-w-[44px] min-h-[44px] justify-center"
            title={sidebarOpen ? "Hide Chapters" : "Show Chapters"}>
            <BookOpen className="w-4 h-4" />
            <span className="hidden md:inline">Chapters</span>
          </button>
          <ReaderSettings settings={settings} onChange={onSettingsChange} />
        </div>
      </div>

      {/* Chapter indicator dots */}
      <div className="flex items-center justify-center gap-1.5 pb-2 px-4">
        {chapters.map((ch, i) => (
          <button key={i} onClick={() => ch.status === "complete" && onSelectChapter(i + 1)}
            className={`w-2 h-2 rounded-full transition-all ${
              i + 1 === currentChapter ? "scale-150" : "opacity-40 hover:opacity-70"
            }`}
            style={{ background: chapterDotColor(ch.status, i + 1 === currentChapter, theme.accent) }}
            title={`Chapter ${i + 1}: ${ch.title} (${ch.status})`} />
        ))}
      </div>
    </div>
  );
}
