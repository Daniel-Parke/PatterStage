// ═══════════════════════════════════════════════════════════════
// dashboard-top-templates.ts — the sort and cap for the dashboard's collapsed
// "Mission Dispatch" strip, which shows DASHBOARD_STRIP_CAP pills and "+N more".
// ═══════════════════════════════════════════════════════════════

/** The two fields the sort reads; any object carrying them will do. */
export interface TemplateForStrip {
  name?: string;
  isCustom?: boolean;
}

/**
 * Twelve until T-0134: at 900px tall the strip was cut at the fold with only
 * its first row visible (the review of 2026-09-08, P4). Six is one row at
 * 1440, and the strip is what one reads to launch, not the catalogue.
 * DispatchStrip reads this rather than carrying its own number.
 */
export const DASHBOARD_STRIP_CAP = 6;

/**
 * The top `n` templates for the collapsed strip: custom first, then by name
 * (undefined names sort last as empty strings). The input is not mutated, and
 * a list already within the cap is copied without sorting.
 *
 * @param templates - The full list, already filtered by the active category
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
