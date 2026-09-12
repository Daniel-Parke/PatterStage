// ── ReaderBody — the reading surface: header, sidebar, text, navigation.
//
// This holds no story state of its own; the long prop list is the page
// handing its state down. What it does hold is the one layout fact the page
// should not: whether the screen is narrow. The chapter list is an aside on
// a wide screen and a Dialog on a narrow one, and the two used to be decided
// by CSS classes on both - so on a wide screen the hidden drawer was still
// mounted, with a live focus trap behind a display:none (U12, T-0126).

"use client";

import { useEffect, useState, type RefObject } from "react";

import ChapterList from "@/modules/rec-room/components/ChapterList";
import ReaderHeader from "@/modules/rec-room/components/ReaderHeader";
import ChapterReader from "@/modules/rec-room/components/ChapterReader";
import ReaderNavigation from "@/modules/rec-room/components/ReaderNavigation";
import MobileChapterDrawer from "@/modules/rec-room/components/MobileChapterDrawer";
import type { ReadingSettings } from "@/modules/rec-room/components/ReaderSettings";
import type { ReaderView } from "@/modules/rec-room/components/story-reader-view";
import type { SpendWindowSource } from "@/lib/spend/spend-window";

export interface ReaderBodyProps {
  title: string;
  /** The page's per-render derivations, from deriveReaderView. */
  view: ReaderView;
  currentChapter: number;
  fontFamily: string;
  settings: ReadingSettings;
  onSettingsChange: (settings: ReadingSettings) => void;
  sidebarOpen: boolean;
  contentRef: RefObject<HTMLDivElement | null>;
  onBack: () => void;
  onContinue: () => void;
  onRetryFailed: () => void;
  /** The write controls (T-0108, D88), passed straight to the header. */
  writing: boolean;
  generating: boolean;
  onWriteNext: () => void;
  onKeepWriting: () => void;
  onStop: () => void;
  onOpenBible: () => void;
  onToggleSidebar: () => void;
  onCloseSidebar: () => void;
  onSelectChapter: (num: number) => void;
  onEditChapter: (chapterNumber: number) => void;
  onRetryChapter: (chapterNumber: number) => void;
  onPrev: () => void;
  onNext: () => void;
  /** What this story has cost so far, drawn in the header. */
  spend: SpendWindowSource | null;
}

/** Below lg the chapter list is a drawer; at lg and up it is an aside. */
function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(max-width: 1023px)");
    const update = () => setNarrow(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return narrow;
}

export default function ReaderBody({
  title,
  view,
  currentChapter,
  fontFamily,
  settings,
  onSettingsChange,
  sidebarOpen,
  contentRef,
  onBack,
  onContinue,
  onRetryFailed,
  writing,
  generating,
  onWriteNext,
  onKeepWriting,
  onStop,
  onOpenBible,
  onToggleSidebar,
  onCloseSidebar,
  onSelectChapter,
  onEditChapter,
  onRetryChapter,
  onPrev,
  onNext,
  spend,
}: ReaderBodyProps) {
  const { chapters, chapterContent, currentMeta, nextComplete, prevChapter, nextChapter, anyFailed, allComplete } = view;
  const narrow = useNarrow();

  return (
    <>
      <ReaderHeader
        title={title}
        chapters={chapters}
        currentChapter={currentChapter}
        allComplete={allComplete}
        anyFailed={anyFailed}
        sidebarOpen={sidebarOpen}
        settings={settings}
        onSettingsChange={onSettingsChange}
        onBack={onBack}
        onContinue={onContinue}
        onRetryFailed={onRetryFailed}
        writing={writing}
        generating={generating}
        pendingCount={view.pendingCount}
        nextPending={view.nextPending}
        onWriteNext={onWriteNext}
        onKeepWriting={onKeepWriting}
        onStop={onStop}
        onOpenBible={onOpenBible}
        onToggleSidebar={onToggleSidebar}
        onSelectChapter={onSelectChapter}
        spend={spend}
      />

      <div className="flex flex-1" style={{ height: "calc(100vh - 72px)" }}>
        {sidebarOpen && !narrow && (
          <aside
            aria-label="Chapters"
            className="sticky top-16 w-56 shrink-0 overflow-y-auto border-r border-ps-edge-hairline bg-ps-surface-panel"
            style={{ maxHeight: "calc(100vh - 64px)" }}
          >
            <div className="p-4">
              <ChapterList chapters={chapters} currentChapter={currentChapter} onSelect={onSelectChapter} />
            </div>
          </aside>
        )}

        <div className="flex flex-1 flex-col overflow-hidden">
          <ChapterReader
            contentRef={contentRef}
            chapterContent={chapterContent}
            currentChapter={currentChapter}
            currentMeta={currentMeta}
            fontFamily={fontFamily}
            settings={settings}
            onEditChapter={onEditChapter}
            onRetryChapter={onRetryChapter}
          />
          <ReaderNavigation
            chapters={chapters}
            currentChapter={currentChapter}
            prevChapter={prevChapter}
            nextChapter={nextChapter}
            hasNext={!!nextComplete}
            onPrev={onPrev}
            onNext={onNext}
            onSelectChapter={onSelectChapter}
          />
        </div>
      </div>

      {sidebarOpen && narrow && (
        <MobileChapterDrawer
          chapters={chapters}
          currentChapter={currentChapter}
          onClose={onCloseSidebar}
          onSelect={onSelectChapter}
        />
      )}
    </>
  );
}
