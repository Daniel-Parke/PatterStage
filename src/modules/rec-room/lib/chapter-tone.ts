// ═══════════════════════════════════════════════════════════════
// chapter-tone — a chapter's rung on the one status ladder.
//
// The reader drew its chapter dots from a second ladder: five warm tints
// (--ps-reader-chapter-*) that were the product's status colours said again
// in another register, so "writing" was one blue in the reader and another
// cyan on every other screen, and a failed chapter was a maroon nothing else
// used. The comment on those tokens called moving them "a design decision for
// the lock-book". The lock-book took it (U12, T-0126): a chapter's state is a
// status like any other, and this is the one place it becomes a rung.
//
// Two axes fold into one word here. A chapter has a STATUS (pending, writing,
// complete, failed) and, once complete, a READ STATUS (unread, read). The
// ladder has a rung for each meaning: writing is Running; pending is Queued;
// failed is Failed; a complete chapter you have read is done and green, and
// one you have not is Waiting for you - the same orange the rest of the
// product uses for "your move".
// ═══════════════════════════════════════════════════════════════

import type { StatusTone } from "@/lib/status-labels";

export interface ChapterLike {
  status: string;
  readStatus?: "writing" | "unread" | "read";
}

export function chapterTone(chapter: ChapterLike): StatusTone {
  switch (chapter.status) {
    case "writing":
      return "running";
    case "failed":
      return "fail";
    case "pending":
      return "queued";
    case "complete":
      return chapter.readStatus === "read" ? "ok" : "blocked";
    default:
      // A chapter that does not exist yet, or a status this code has never
      // heard of: the quiet rung, which is what the old ladder's trailing
      // `else` did too.
      return "idle";
  }
}
