// ── deriveReaderView — the reader's per-render derivations, in one place.
// Pure helper, extracted verbatim from app/recroom/story-weaver/[id]/page.tsx
// where these eight consts sat between the guards and the return. Same
// expressions, same order, no behaviour: Story Weaver behaviour is out of
// scope for T-0011.

import type { Chapter, StoryState } from "@/modules/rec-room/components/story-reader-types";

export interface ReaderView {
  chapters: Chapter[];
  chapterContent: string;
  currentMeta: Chapter | undefined;
  nextComplete: Chapter | undefined;
  prevChapter: Chapter | null;
  nextChapter: Chapter | null;
  anyFailed: boolean;
  allComplete: boolean;
  /** Chapters still to write. */
  pendingCount: number;
  /** The next one's number, or null when there is none. */
  nextPending: number | null;
}

export function deriveReaderView(story: StoryState, currentChapter: number): ReaderView {
  const chapters: Chapter[] = story.chapters || [];
  const chapterContent = story.chapterContents?.[currentChapter] || "";
  const currentMeta = chapters[currentChapter - 1];
  const nextComplete = chapters.find((c: Chapter) => c.number > currentChapter && c.status === "complete");
  const prevChapter = currentChapter > 1 ? chapters[currentChapter - 2] : null;
  const nextChapter = nextComplete ? chapters[nextComplete.number - 1] : null;
  const anyFailed = chapters.some((c: Chapter) => c.status === "failed");
  const allComplete = chapters.length > 0 && chapters.every((c: Chapter) => c.status === "complete");
  const pending = chapters.filter((c: Chapter) => c.status === "pending");
  return {
    chapters,
    chapterContent,
    currentMeta,
    nextComplete,
    prevChapter,
    nextChapter,
    anyFailed,
    allComplete,
    pendingCount: pending.length,
    nextPending: pending.length > 0 ? pending[0].number : null,
  };
}
