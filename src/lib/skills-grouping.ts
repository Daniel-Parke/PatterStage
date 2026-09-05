// ═══════════════════════════════════════════════════════════════
// groupByCategory — Shared category grouping for the skills API and
// the Skills Manager page.
//
// Both consumers previously did the same loop in isolation, and both
// had a case-sensitivity bug that produced duplicate categories
// (e.g. "Creative" + "creative" as separate buckets) when skill
// frontmatter disagreed on the spelling of the category name.
//
// This helper normalizes the category for grouping, and returns the
// input skills unchanged so callers can still display the original
// casing if they want.
//
// T-0037: the key normalizes exactly as far as the DISPLAY does, and
// through the same code. Lowercasing alone was not enough, because
// titleCaseCategory also folds hyphens and underscores to spaces: the
// key drew word boundaries the label did not, so "Control Hub" and
// "control-hub" rendered one identical label out of two buckets, and
// the catalogue showed the same category twice. Since T-0032 that key
// is load-bearing, because collapse and paging state hang off it, so a
// split bucket also split its own state.
//
// The invariant, and the reason both functions share `categoryWords`:
//
//     titleCaseCategory(raw).toLowerCase() === the grouping key
//
// Same rendered label, same bucket, one state. It stops there: a
// spelling that renders differently, "controlhub" against
// "Control Hub", is still its own bucket, because merging labels that
// do not match would leave the header text depending on whichever row
// the catalogue returned first.
//
// Audit reference: dogfood-output/report.md Issue #2.
// ═══════════════════════════════════════════════════════════════

export interface HasCategory {
  category: string;
}

/**
 * The words a category is made of: case, hyphens, underscores and runs
 * of whitespace all stop mattering. The single fold both the grouping
 * key and the display label are built from, so neither can drift from
 * the other.
 */
function categoryWords(s: string): string[] {
  return s
    .replace(/[-_]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

/**
 * Group items by their `category` field, treating every spelling that
 * RENDERS the same label as the same group: "Creative"/"creative", and
 * equally "Control Hub"/"control-hub"/"control_hub". Items with missing
 * or whitespace-only categories fall into the "uncategorized" bucket.
 *
 * Returns a sorted array of [normalizedKey, items] pairs, where the key
 * is the lowercase space-separated canonical form, which is exactly
 * `titleCaseCategory(category).toLowerCase()`.
 */
export function groupByCategory<T extends HasCategory>(
  items: T[],
  fallback: string = "uncategorized"
): Array<[string, T[]]> {
  const groups: Record<string, T[]> = {};
  for (const item of items) {
    const raw = categoryWords(item.category ?? "").join(" ");
    const key = (raw || categoryWords(fallback).join(" ")).toLowerCase();
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
 *   "MLOps" -> "Mlops"   (same, and deliberately: see titleCaseCategory)
 */
export function titleCaseCategory(s: string | null | undefined): string {
  if (!s) return "";
  return categoryWords(s)
    // The REMAINDER is lower-cased, not just the first letter raised. Without
    // it, "CONTROL HUB" rendered as "CONTROL HUB" while "control-hub" rendered
    // as "Control Hub", and since skills-page-helpers takes a bucket's heading
    // from its FIRST member, the heading depended on catalogue order. That is
    // the exact failure the comment above says this design prevents (T-0053).
    //
    // The cost, accepted deliberately and already stated in the examples below:
    // an acronym is title-cased too, so "MLOps" renders "Mlops". A category
    // whose heading flickers with data order is worse than one that is
    // consistently plain.
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}
