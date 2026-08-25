// ═══════════════════════════════════════════════════════════════
// chapter-dot.ts — the colour of one chapter dot in the Story Weaver reader.
//
// ReaderHeader and ReaderNavigation both draw the same row of dots, and both
// carried the same five-branch conditional written as inline hex, twice, in a
// single unbroken line. Two copies of a status map is one copy too many: the
// header and the footer of the same reader disagreeing about what "pending"
// looks like is a defect nobody would ever file, because nobody looks at both
// ends of a page at once.
//
// The values are now tokens (--ps-reader-chapter-* in globals.css), which is
// where design-lint's `no-raw-colour-in-tsx` law says colour lives, and this is
// the one place that maps a status to one (T-0034).
// ═══════════════════════════════════════════════════════════════

/**
 * The dot colour for a chapter, given its status and whether it is the chapter
 * being read.
 *
 * The current chapter is the reader's own position, so it flies the register's
 * accent rather than a state tint; every other completed chapter is the quiet
 * "done" tint. An unrecognised status is treated as not started, which is what
 * the original conditional's trailing `else` did.
 */
export function chapterDotColor(status: string, isCurrent: boolean, accent: string): string {
  if (status === "complete") return isCurrent ? accent : "var(--ps-reader-chapter-done)";
  if (status === "writing") return "var(--ps-reader-chapter-writing)";
  if (status === "pending") return "var(--ps-reader-chapter-pending)";
  if (status === "failed") return "var(--ps-reader-chapter-failed)";
  return "var(--ps-reader-chapter-idle)";
}
