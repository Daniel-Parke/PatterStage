// ═══════════════════════════════════════════════════════════════
// dashboard-helpers.ts — Pure helpers for the Dashboard page
// ═══════════════════════════════════════════════════════════════
//
//   - `composeTemplateUrl(templateId)` — builds the URL the page links to
//     when a template pill is clicked in the Mission Dispatch strip.

/** Build the missions page URL that opens the compose form prefilled with this template. */
export function composeTemplateUrl(templateId: string): string {
  return `/orchestration/missions?template=${templateId}&compose=1`;
}
