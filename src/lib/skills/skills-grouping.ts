// ═══════════════════════════════════════════════════════════════
// groupByCategory — category grouping shared by the skills API and the Skills
// Manager page, which each had a case-sensitivity bug ("Creative" and
// "creative" as two buckets). Items come back unchanged, so callers keep the
// original casing.
//
// T-0037: the key normalizes exactly as far as the DISPLAY does, through the
// same code, because titleCaseCategory also folds hyphens and underscores:
// "Control Hub" and "control-hub" rendered one label from two buckets, and
// since T-0032 collapse and paging state hang off the key, a split bucket split
// its state. The invariant, shared through `categoryWords`:
//     titleCaseCategory(raw).toLowerCase() === the grouping key
// It stops there: "controlhub" against "Control Hub" stays its own bucket, since
// merging labels that differ would leave the header depending on row order.
// Audit reference: dogfood-output/report.md Issue #2.
// ═══════════════════════════════════════════════════════════════

export interface HasCategory {
  category: string;
}

/** The words a category is made of; the single fold both the key and the label are built from. */
function categoryWords(s: string): string[] {
  return s
    .replace(/[-_]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

/**
 * Group items by `category`, treating every spelling that RENDERS the same
 * label as one group. Missing or blank categories fall into `fallback`.
 * Returns sorted [key, items] pairs, the key being
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
 * Title-case a category for display, preserving word boundaries. An acronym is
 * title-cased too ("MLOps" renders "Mlops"), deliberately; see below.
 */
export function titleCaseCategory(s: string | null | undefined): string {
  if (!s) return "";
  return categoryWords(s)
    // The REMAINDER is lower-cased too. Without it "CONTROL HUB" and
    // "control-hub" rendered two labels, and since skills-page-helpers takes a
    // bucket's heading from its FIRST member, the heading depended on catalogue
    // order (T-0053). The cost is the acronym above: a heading that flickers
    // with data order is worse than one that is consistently plain.
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}
