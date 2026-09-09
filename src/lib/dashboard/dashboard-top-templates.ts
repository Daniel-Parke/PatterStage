// ═══════════════════════════════════════════════════════════════
// dashboard-top-templates.ts — Pure helper for the template strip cap
// ═══════════════════════════════════════════════════════════════
//
// The dashboard's "Mission Dispatch" quick-launch strip (the
// collapsed state below the section header) renders up to 12
// template pills. When the user has more than 12 templates, the
// strip is capped at 12 with a "+N more" pill that expands the
// panel. The cap-ordering rule is:
//
//   1. Custom templates first (the user-authored ones go to the top)
//   2. Then alphabetical by name (case-insensitive)
//
// The cap + sort logic was inline in `src/app/page.tsx` (a 9-line
// `useMemo` with a `[...templates].sort()` and `.slice(0, 12)`).
// Extracted to a pure helper so the rule is unit-testable without
// rendering the dashboard.

/**
 * Subset of the template shape the sort+cap helper needs. The
 * dashboard's `TemplateListItem` is defined in
 * `src/app/page.tsx`; we accept any object with the two fields the
 * algorithm reads, so the helper stays reusable from any future
 * surface (e.g. a "Recent templates" widget on the missions page).
 */
export interface TemplateForStrip {
  name?: string;
  isCustom?: boolean;
}

/**
 * How many templates the dashboard's collapsed strip shows before "+N more".
 * Twelve until T-0134: at 900px tall the strip was cut at the fold and only
 * its first row of pills was visible (the review of 2026-09-08, P4). Six is
 * one row at 1440, and the strip is what one reads to launch, not the
 * catalogue. DispatchStrip reads this rather than carrying its own number.
 */
export const DASHBOARD_STRIP_CAP = 6;

/**
 * Return the top `n` templates (default DASHBOARD_STRIP_CAP) for the
 * dashboard's collapsed template strip, ordered by the priority ladder:
 * custom templates first, then alphabetical by name (with
 * undefined names sorted last as empty strings).
 *
 * The input is not mutated. When `templates.length <= n`, the
 * original array is returned unchanged (a no-op fast path so the
 * dashboard's `useMemo` doesn't re-allocate on the common
 * few-templates case).
 *
 * @param templates - The full template list (already filtered by the
 *                    active category, if any)
 * @param n         - The cap; defaults to DASHBOARD_STRIP_CAP
 */
export function topNTemplates<T extends TemplateForStrip>(
  templates: readonly T[],
  n: number = DASHBOARD_STRIP_CAP,
): T[] {
  if (templates.length <= n) return [...templates];
  const sorted = [...templates].sort((a, b) => {
    if (a.isCustom !== b.isCustom) return a.isCustom ? -1 : 1;
    return (a.name ?? "").localeCompare(b.name ?? "");
  });
  return sorted.slice(0, n);
}
