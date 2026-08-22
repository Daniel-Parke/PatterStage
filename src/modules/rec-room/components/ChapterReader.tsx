// ── ChapterReader — the four states of the reading surface.
// Extracted verbatim from app/recroom/story-weaver/[id]/page.tsx: the
// chapter text, the "being written" placeholder, the failed-chapter
// recovery pair and the nothing-selected fallback. Story Weaver
// behaviour is out of scope for T-0011, so the branch order and the
// styling are copied unchanged.

"use client";

import type { RefObject } from "react";
import { AlertTriangle, PenLine, RefreshCw, Sparkles } from "lucide-react";
import type { ReadingSettings } from "@/modules/rec-room/components/ReaderSettings";
import type { Chapter, ReaderTheme } from "@/modules/rec-room/components/story-reader-types";

export interface ChapterReaderProps {
  contentRef: RefObject<HTMLDivElement | null>;
  chapterContent: string;
  currentChapter: number;
  currentMeta: Chapter | undefined;
  theme: ReaderTheme;
  fontFamily: string;
  settings: ReadingSettings;
  onEditChapter: (chapterNumber: number) => void;
  onRetryChapter: (chapterNumber: number) => void;
}

export default function ChapterReader({
  contentRef,
  chapterContent,
  currentChapter,
  currentMeta,
  theme,
  fontFamily,
  settings,
  onEditChapter,
  onRetryChapter,
}: ChapterReaderProps) {
  return (
    <div ref={contentRef} className="flex-1 w-full overflow-y-auto" style={{ background: theme.bg, filter: `brightness(${settings.brightness})` }}>
      {chapterContent ? (
        <div className="max-w-3xl mx-auto px-6 md:px-16 py-8 md:py-10">
          <div id="chapter-top" className="flex items-center justify-between mb-8 pb-4 border-b scroll-mt-16" style={{
            borderColor: theme.rule,
          }}>
            <h2 style={{
              color: theme.text,
              fontFamily,
              fontSize: `${settings.fontSize + 6}px`,
              fontWeight: 600,
            }}>
              Chapter {currentChapter}: {currentMeta?.title}
            </h2>
            {/* Edit button on completed chapters */}
            {currentMeta?.status === "complete" && (
              <button onClick={() => onEditChapter(currentChapter)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-[10px] font-mono text-white/40 hover:text-neon-purple hover:border-neon-purple/30 transition-colors flex-shrink-0"
                title="Edit this chapter">
                <PenLine className="w-3 h-3" />
                Edit
              </button>
            )}
          </div>
          <div className="whitespace-pre-wrap text-justify" style={{
            color: theme.text, fontFamily,
            fontSize: `${settings.fontSize}px`, lineHeight: settings.lineHeight,
          }}>
            {chapterContent}
          </div>
        </div>
      ) : currentMeta?.status === "writing" || currentMeta?.status === "pending" ? (
        <div className="flex flex-col items-center justify-center h-full min-h-[400px]">
          <Sparkles className="w-8 h-8 animate-pulse mb-4" style={{ color: theme.accent }} />
          <p className="text-sm" style={{ color: theme.text, opacity: 0.5, fontFamily }}>
            {currentMeta.status === "writing" ? "The muse is visiting..." : "Waiting for its moment..."}
          </p>
          <p className="text-xs mt-2" style={{ color: theme.text, opacity: 0.3 }}>
            Chapter {currentChapter} is being written
          </p>
        </div>
      ) : currentMeta?.status === "failed" ? (
        <div className="flex flex-col items-center justify-center h-full min-h-[400px] px-6">
          <AlertTriangle className="w-8 h-8 mb-4 text-red-400" />
          <p className="text-sm text-red-300 mb-2">Chapter {currentChapter} failed to generate</p>
          {currentMeta.error && (
            <p className="text-xs text-red-300/50 mb-4 max-w-md text-center">{currentMeta.error}</p>
          )}
          <div className="flex gap-2">
            <button onClick={() => onRetryChapter(currentChapter)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-orange-500/30 text-xs text-orange-400 bg-orange-500/10 hover:bg-orange-500/20">
              <RefreshCw className="w-3 h-3" /> Retry Chapter
            </button>
            <button onClick={() => onEditChapter(currentChapter)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-neon-purple/30 text-xs text-neon-purple bg-neon-purple/10 hover:bg-neon-purple/20">
              <PenLine className="w-3 h-3" /> Rewrite with Prompt
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center h-full min-h-[400px]">
          <p className="text-sm" style={{ color: theme.text, opacity: 0.3 }}>Select a chapter to read</p>
        </div>
      )}
    </div>
  );
}
