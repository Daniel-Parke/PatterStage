// ── ReaderHeader — the sticky reader bar and the chapter dots.
//
// Eight raw buttons in eight chromes, and a row of 8px dots painted from the
// reader's private status ladder. The buttons are Buttons, the dots are
// ChapterDots on the house ladder, and the bar sits on the panel rung like
// every other bar (U12, T-0126). Every action is still a callback to the page.

"use client";

import { BookMarked, BookOpen, ChevronLeft, PlayCircle, RefreshCw, Square } from "lucide-react";

import Button from "@/components/ui/Button";
import IconButton from "@/components/ui/IconButton";
import ChapterDots from "@/modules/rec-room/components/ChapterDots";
import ReaderSettings, { type ReadingSettings } from "@/modules/rec-room/components/ReaderSettings";
import StorySpendNote from "@/modules/rec-room/components/StorySpendNote";
import type { Chapter } from "@/modules/rec-room/components/story-reader-types";
import type { SpendWindowSource } from "@/lib/spend/spend-window";

export interface ReaderHeaderProps {
  title: string;
  chapters: Chapter[];
  currentChapter: number;
  allComplete: boolean;
  anyFailed: boolean;
  sidebarOpen: boolean;
  settings: ReadingSettings;
  onSettingsChange: (settings: ReadingSettings) => void;
  onBack: () => void;
  onContinue: () => void;
  onRetryFailed: () => void;
  /** The operator's standing intent to keep writing (T-0108, D88). */
  writing: boolean;
  generating: boolean;
  pendingCount: number;
  nextPending: number | null;
  onWriteNext: () => void;
  onKeepWriting: () => void;
  onStop: () => void;
  onOpenBible: () => void;
  onToggleSidebar: () => void;
  onSelectChapter: (num: number) => void;
  /** What this story has cost so far, or null while it is unknown. */
  spend: SpendWindowSource | null;
}

export default function ReaderHeader({
  title,
  chapters,
  currentChapter,
  allComplete,
  anyFailed,
  sidebarOpen,
  settings,
  onSettingsChange,
  onBack,
  onContinue,
  onRetryFailed,
  writing,
  generating,
  pendingCount,
  nextPending,
  onWriteNext,
  onKeepWriting,
  onStop,
  onOpenBible,
  onToggleSidebar,
  onSelectChapter,
  spend,
}: ReaderHeaderProps) {
  return (
    <div className="sticky top-0 z-sticky shrink-0 border-b border-ps-edge-hairline bg-ps-surface-panel">
      {/* Below md the actions take a row of their own and wrap; on one row with
          the title they pushed it to nothing and ran 7px past the screen (found
          on the T-0126 phone walk). */}
      <div className="flex min-h-[var(--ps-shell-header-min-height)] flex-wrap items-center gap-x-2 gap-y-1 px-3 py-1 md:flex-nowrap md:px-6">
        <IconButton icon={ChevronLeft} label="Back to the library" onClick={onBack} />
        <div className="mx-2 min-w-0 flex-1 text-center">
          <div className="font-mono text-micro uppercase tracking-wider text-ps-text-faint">Story Weaver</div>
          <h1 className="truncate text-body font-semibold text-ps-text-primary">{title}</h1>
        </div>
        <div className="flex basis-full flex-wrap items-center justify-end gap-1.5 md:basis-auto md:shrink-0">
          {/* Nothing is written unless it is asked for. This header used to
              offer no way to start OR stop: an effect wrote the next chapter
              the moment the page opened (T-0108, D88). */}
          {writing || generating ? (
            <Button variant="danger" icon={Square} onClick={onStop} title="Stop" aria-label="Stop">
              Stop
            </Button>
          ) : nextPending !== null ? (
            <>
              <Button color="cyan" onClick={onWriteNext} title={`Write chapter ${nextPending}`} aria-label={`Write chapter ${nextPending}`}>
                <span className="hidden md:inline">Write chapter {nextPending}</span>
                <span className="md:hidden">Write</span>
              </Button>
              {pendingCount > 1 && (
                <Button
                  color="cyan"
                  onClick={onKeepWriting}
                  title={`Keep writing (${pendingCount} chapters left)`}
                  aria-label={`Keep writing (${pendingCount} chapters left)`}
                >
                  <span className="hidden md:inline">Keep writing ({pendingCount} chapters left)</span>
                  <span className="md:hidden">Keep writing</span>
                </Button>
              )}
            </>
          ) : null}
          {allComplete && (
            <Button color="green" icon={PlayCircle} onClick={onContinue} title="Continue this story">
              <span className="hidden md:inline">Continue</span>
            </Button>
          )}
          {anyFailed && (
            <Button color="orange" icon={RefreshCw} onClick={onRetryFailed} title="Retry failed chapters">
              <span className="hidden md:inline">Retry</span>
            </Button>
          )}
          <Button color="purple" icon={BookMarked} onClick={onOpenBible} title="Story Bible — arc, plot points & character journeys">
            <span className="hidden md:inline">Bible</span>
          </Button>
          <Button
            icon={BookOpen}
            onClick={onToggleSidebar}
            aria-pressed={sidebarOpen}
            title={sidebarOpen ? "Hide chapters" : "Show chapters"}
          >
            <span className="hidden md:inline">Chapters</span>
          </Button>
          <ReaderSettings settings={settings} onChange={onSettingsChange} />
        </div>
      </div>

      {/* Chapter dots, and what the story has cost so far. The cost sits on
          this row rather than a row of its own so the sticky header keeps its
          height, and beside the write buttons rather than in Insights so it
          is where the money is being spent. */}
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 pb-1">
        <ChapterDots chapters={chapters} currentChapter={currentChapter} onSelect={onSelectChapter} withTitles />
        <StorySpendNote spend={spend} />
      </div>
    </div>
  );
}
