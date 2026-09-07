// ── ChapterReader — the four states of the reading surface.
// The chapter text, the "being written" placeholder, the failed-chapter
// recovery pair and the nothing-selected fallback. The surface is the warm
// register - page, ink, rule - as three classes rather than a theme object
// threaded through five components (U12, T-0126); the controls are Buttons.

"use client";

import type { RefObject } from "react";
import { AlertTriangle, PenLine, RefreshCw, Sparkles } from "lucide-react";

import Button from "@/components/ui/Button";
import { statusToneClasses } from "@/lib/theme";
import type { ReadingSettings } from "@/modules/rec-room/components/ReaderSettings";
import type { Chapter } from "@/modules/rec-room/components/story-reader-types";
import { chapterHeading } from "@/modules/rec-room/lib/chapter-title";

export interface ChapterReaderProps {
  contentRef: RefObject<HTMLDivElement | null>;
  chapterContent: string;
  currentChapter: number;
  currentMeta: Chapter | undefined;
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
  fontFamily,
  settings,
  onEditChapter,
  onRetryChapter,
}: ChapterReaderProps) {
  return (
    <div
      ref={contentRef}
      className="w-full flex-1 overflow-y-auto bg-ps-reader-page text-ps-reader-ink"
      style={{ filter: `brightness(${settings.brightness})` }}
    >
      {chapterContent ? (
        <div className="mx-auto max-w-3xl px-6 py-8 md:px-16 md:py-10">
          <div id="chapter-top" className="mb-8 flex items-center justify-between gap-3 border-b border-ps-reader-rule pb-4 scroll-mt-16">
            <h2 style={{ fontFamily, fontSize: `${settings.fontSize + 6}px`, fontWeight: 600 }}>
              {chapterHeading(currentChapter, currentMeta?.title)}
            </h2>
            {currentMeta?.status === "complete" && (
              <Button variant="ghost" size="sm" icon={PenLine} onClick={() => onEditChapter(currentChapter)} title="Edit this chapter">
                Edit
              </Button>
            )}
          </div>
          <div
            className="whitespace-pre-wrap text-justify"
            style={{ fontFamily, fontSize: `${settings.fontSize}px`, lineHeight: settings.lineHeight }}
          >
            {chapterContent}
          </div>
        </div>
      ) : currentMeta?.status === "writing" || currentMeta?.status === "pending" ? (
        <div className="flex h-full min-h-[400px] flex-col items-center justify-center">
          <Sparkles className="mb-4 h-8 w-8 animate-pulse text-neon-purple" aria-hidden="true" />
          <p className="text-body opacity-60" style={{ fontFamily }}>
            {currentMeta.status === "writing" ? "The muse is visiting..." : "Waiting for its moment..."}
          </p>
          <p className="mt-2 text-body opacity-40">Chapter {currentChapter} is being written</p>
        </div>
      ) : currentMeta?.status === "failed" ? (
        <div className="flex h-full min-h-[400px] flex-col items-center justify-center px-6">
          <AlertTriangle className={`mb-4 h-8 w-8 ${statusToneClasses.fail.text}`} aria-hidden="true" />
          <p className={`mb-2 text-body ${statusToneClasses.fail.text}`}>Chapter {currentChapter} failed to generate</p>
          {currentMeta.error && (
            <p className="mb-4 max-w-md text-center text-body opacity-70">{currentMeta.error}</p>
          )}
          <div className="flex flex-wrap justify-center gap-2">
            <Button color="orange" icon={RefreshCw} onClick={() => onRetryChapter(currentChapter)}>
              Retry chapter
            </Button>
            <Button color="purple" icon={PenLine} onClick={() => onEditChapter(currentChapter)}>
              Rewrite with a prompt
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex h-full min-h-[400px] items-center justify-center">
          <p className="text-body opacity-40">Select a chapter to read</p>
        </div>
      )}
    </div>
  );
}
