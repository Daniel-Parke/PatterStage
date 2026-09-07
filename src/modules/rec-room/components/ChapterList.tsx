// ChapterList — the chapter sidebar, one row per chapter with its rung.
//
// The dot was four raw palette classes (blue, green, orange, white/15) for
// four states the status ladder already names. It reads chapterTone now, so
// a chapter being written pulses the same cyan a running mission does
// (U12, T-0126). The row stays a raw button: it is a two-line list row with
// a dot, which no primitive draws.
"use client";

import { statusToneClasses } from "@/lib/theme";
import { chapterTone } from "@/modules/rec-room/lib/chapter-tone";
import type { Chapter } from "@/modules/rec-room/components/story-reader-types";

export default function ChapterList({ chapters, currentChapter, onSelect }: {
  chapters: Chapter[]; currentChapter: number; onSelect: (num: number) => void;
}) {
  return (
    <div className="space-y-0.5">
      {chapters.map((ch) => {
        const canRead = ch.status === "complete";
        const isCurrent = ch.number === currentChapter;
        const tone = chapterTone(ch);
        return (
          <button key={ch.number} type="button" onClick={() => canRead && onSelect(ch.number)}
            disabled={!canRead}
            aria-current={isCurrent ? "true" : undefined}
            className={`flex w-full items-center justify-between gap-2 rounded-ps-md px-3 py-2.5 text-left transition-colors ${
              isCurrent ? "bg-ps-surface-raised" : "hover:bg-ps-surface-raised"
            } disabled:cursor-default disabled:opacity-50`}>
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                aria-hidden="true"
                className={`h-2.5 w-2.5 shrink-0 rounded-full ${statusToneClasses[tone].dot} ${tone === "running" ? "animate-pulse" : ""}`}
              />
              <div className="min-w-0">
                <div className={`truncate text-body ${isCurrent ? "text-ps-text-primary" : "text-ps-text-secondary"}`}>
                  {ch.title}
                </div>
                <div className="font-mono text-micro text-ps-text-faint">
                  {ch.status === "complete" ? `${ch.wordCount} words` : ch.status}
                </div>
              </div>
            </div>
            {ch.readStatus === "read" && (
              <span className={`shrink-0 text-body ${statusToneClasses.ok.text}`} aria-label="Read">✓</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
