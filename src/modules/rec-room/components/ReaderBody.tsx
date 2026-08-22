// ── ReaderBody — the reading surface: header, sidebar, text, navigation.
// Extracted verbatim from app/recroom/story-weaver/[id]/page.tsx, in the
// same DOM order it had there: the sticky header, the flex body with the
// desktop chapter sidebar and the chapter text plus its navigation bar,
// and then the small-screen chapter drawer.
//
// Story Weaver behaviour is out of scope for T-0011. This holds no state
// of its own; the long prop list is the page handing its state down.

"use client";

import type { RefObject } from "react";
import ChapterList from "@/modules/rec-room/components/ChapterList";
import ReaderHeader from "@/modules/rec-room/components/ReaderHeader";
import ChapterReader from "@/modules/rec-room/components/ChapterReader";
import ReaderNavigation from "@/modules/rec-room/components/ReaderNavigation";
import MobileChapterDrawer from "@/modules/rec-room/components/MobileChapterDrawer";
import type { ReadingSettings } from "@/modules/rec-room/components/ReaderSettings";
import type { ReaderTheme } from "@/modules/rec-room/components/story-reader-types";
import type { ReaderView } from "@/modules/rec-room/components/story-reader-view";

export interface ReaderBodyProps {
  title: string;
  /** The page's per-render derivations, from deriveReaderView. */
  view: ReaderView;
  currentChapter: number;
  theme: ReaderTheme;
  fontFamily: string;
  settings: ReadingSettings;
  onSettingsChange: (settings: ReadingSettings) => void;
  sidebarOpen: boolean;
  contentRef: RefObject<HTMLDivElement | null>;
  onBack: () => void;
  onContinue: () => void;
  onRetryFailed: () => void;
  onOpenBible: () => void;
  onToggleSidebar: () => void;
  onCloseSidebar: () => void;
  onSelectChapter: (num: number) => void;
  onEditChapter: (chapterNumber: number) => void;
  onRetryChapter: (chapterNumber: number) => void;
  onPrev: () => void;
  onNext: () => void;
}

export default function ReaderBody({
  title,
  view,
  currentChapter,
  theme,
  fontFamily,
  settings,
  onSettingsChange,
  sidebarOpen,
  contentRef,
  onBack,
  onContinue,
  onRetryFailed,
  onOpenBible,
  onToggleSidebar,
  onCloseSidebar,
  onSelectChapter,
  onEditChapter,
  onRetryChapter,
  onPrev,
  onNext,
}: ReaderBodyProps) {
  const { chapters, chapterContent, currentMeta, nextComplete, prevChapter, nextChapter, anyFailed, allComplete } = view;

  return (
    <>
      {/* Reader Header */}
      <ReaderHeader
        title={title}
        chapters={chapters}
        currentChapter={currentChapter}
        theme={theme}
        allComplete={allComplete}
        anyFailed={anyFailed}
        sidebarOpen={sidebarOpen}
        settings={settings}
        onSettingsChange={onSettingsChange}
        onBack={onBack}
        onContinue={onContinue}
        onRetryFailed={onRetryFailed}
        onOpenBible={onOpenBible}
        onToggleSidebar={onToggleSidebar}
        onSelectChapter={onSelectChapter}
      />

      {/* Body */}
      <div className="flex-1 flex" style={{ height: "calc(100vh - 72px)" }}>
        {/* Chapter Sidebar */}
        {sidebarOpen && (
          <div className="w-56 flex-shrink-0 border-r border-white/5 sticky top-16 overflow-y-auto hidden md:block" style={{ background: theme.panel, maxHeight: "calc(100vh - 64px)" }}>
            <div className="p-4">
              <ChapterList chapters={chapters} currentChapter={currentChapter} onSelect={onSelectChapter} />
            </div>
          </div>
        )}

        {/* Book Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <ChapterReader
            contentRef={contentRef}
            chapterContent={chapterContent}
            currentChapter={currentChapter}
            currentMeta={currentMeta}
            theme={theme}
            fontFamily={fontFamily}
            settings={settings}
            onEditChapter={onEditChapter}
            onRetryChapter={onRetryChapter}
          />

          {/* Navigation */}
          <ReaderNavigation
            chapters={chapters}
            currentChapter={currentChapter}
            prevChapter={prevChapter}
            nextChapter={nextChapter}
            hasNext={!!nextComplete}
            theme={theme}
            onPrev={onPrev}
            onNext={onNext}
            onSelectChapter={onSelectChapter}
          />
        </div>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <MobileChapterDrawer
          chapters={chapters}
          currentChapter={currentChapter}
          theme={theme}
          onClose={onCloseSidebar}
          onSelect={onSelectChapter}
        />
      )}
    </>
  );
}
