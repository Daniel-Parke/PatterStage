// ═══════════════════════════════════════════════════════════════
// chapter-title.ts — the one place a model-supplied chapter title is bounded
//
// `create.ts` took `ch.title` from the story-arc the model returned and wrote it
// straight onto the chapter record: any length, newlines included, no fallback.
// That string is then rendered in a heading and in the reader's chapter
// navigation, both of which are single-line layouts, so a model that answered
// with a paragraph — or with an empty string — broke the page rather than the
// generation (T-0071).
//
// The fallback is the SAME string the file already uses for a missing outline
// entry a few lines above (`Chapter ${i + 1}`), so an absent title and an
// unusable one land on one name rather than two.
// ═══════════════════════════════════════════════════════════════

/** Longest title the reader's heading and nav list render on one line. */
const MAX_TITLE = 80;

/**
 * Bound a model-supplied chapter title.
 *
 * @param raw   whatever the model put in `chapterOutlines[i].title`
 * @param index zero-based chapter index, used for the fallback name
 */
export function chapterTitle(raw: unknown, index: number): string {
  const fallback = `Chapter ${index + 1}`;
  if (typeof raw !== "string") return fallback;

  // Newlines collapse rather than truncate: a two-line title is still a title,
  // and cutting at the first break would silently drop half of it.
  const flat = raw.replace(/\s+/g, " ").trim();
  if (flat.length === 0) return fallback;
  if (flat.length <= MAX_TITLE) return flat;

  // Trim to the last word boundary inside the cap where there is one, so the
  // ellipsis does not land mid-word.
  const cut = flat.slice(0, MAX_TITLE - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > MAX_TITLE / 2 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/**
 * The reader's heading for one chapter.
 *
 * `chapterTitle` falls back to "Chapter N", which the heading then prefixed
 * with "Chapter N: " (T-0108). A title that is only the chapter's own name is
 * not a title.
 */
export function chapterHeading(number: number, title: string | undefined | null): string {
  const t = (title ?? "").trim();
  if (!t || t.toLowerCase() === `chapter ${number}`.toLowerCase()) return `Chapter ${number}`;
  return `Chapter ${number}: ${t}`;
}
