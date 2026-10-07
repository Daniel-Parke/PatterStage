// ── MobileChapterDrawer — the chapter list as a small-screen sheet.
// A Dialog on the shared contract, so Escape closes it and focus goes back to
// the button that opened it (T-0096, D116); the chrome is Dialog's now rather
// than a hand-rolled fixed overlay (U12, T-0126). Mounted only while it is
// open on a narrow screen - ReaderBody decides that.

"use client";

import Dialog from "@/components/ui/Dialog";
import ChapterList from "@/modules/rec-room/components/ChapterList";
import type { Chapter } from "@/modules/rec-room/components/story-reader-types";

export default function MobileChapterDrawer({
  chapters,
  currentChapter,
  onClose,
  onSelect,
}: {
  chapters: Chapter[];
  currentChapter: number;
  onClose: () => void;
  onSelect: (num: number) => void;
}) {
  return (
    <Dialog open onClose={onClose} placement="sheet" title="Chapters" closeLabel="Close chapter list">
      <ChapterList chapters={chapters} currentChapter={currentChapter} onSelect={onSelect} />
    </Dialog>
  );
}
