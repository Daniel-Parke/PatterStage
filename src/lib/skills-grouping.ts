// ═══════════════════════════════════════════════════════════════
// groupByCategory — Shared category grouping for the skills API and
// the Skills Manager page.
//
// Both consumers previously did the same loop in isolation, and both
// had a case-sensitivity bug that produced duplicate categories
// (e.g. "Creative" + "creative" as separate buckets) when skill
// frontmatter disagreed on the spelling of the category name.
//
// This helper normalizes the category to lowercase for grouping, and
// returns the input skills unchanged so callers can still display
// the original casing if they want.
//
// Audit reference: dogfood-output/report.md Issue #2.
// ═══════════════════════════════════════════════════════════════

export interface HasCategory {
  category: string;
}

/**
 * Group items by their `category` field, treating different cases
 * ("Creative" vs "creative") as the same group. Items with missing
 * or whitespace-only categories fall into the "uncategorized" bucket.
 *
 * Returns a sorted array of [normalizedKey, items] pairs, where the
 * key is the lowercase canonical form.
 */
export function groupByCategory<T extends HasCategory>(
  items: T[],
  fallback: string = "uncategorized"
): Array<[string, T[]]> {
  const groups: Record<string, T[]> = {};
  for (const item of items) {
    const raw = (item.category ?? "").trim();
    const key = raw ? raw.toLowerCase() : fallback.toLowerCase();
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  }
  return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
}

/**
 * Title-case a category string for display. Preserves word boundaries
 * (spaces, hyphens, underscores).
 *
 * Examples:
 *   "creative" -> "Creative"
 *   "code-review" -> "Code Review"
 *   "mlops" -> "Mlops"   (intentional; no special-casing for acronyms)
 */
export function titleCaseCategory(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/[-_]+/g, " ")
    .split(/\s+/)
    .map((w) => (w.length === 0 ? w : w[0].toUpperCase() + w.slice(1)))
    .join(" ");
}
