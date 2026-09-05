// ═══════════════════════════════════════════════════════════════
// dashboard-model-subtitle.ts — Pure helper for the dashboard header subtitle
// ═══════════════════════════════════════════════════════════════
//
// The dashboard header (src/app/page.tsx) renders a subtitle that
// names the model the agent will use. The subtitle has 3 source
// layers, in priority order:
//
//   1. The model + provider written to config.yaml (the disk-truth)
//   2. The "default agent" model from the Models registry (the
//      user has set a default but hasn't yet pushed it to disk)
//   3. "-" (no model known)
//
// The inline form was a 9-line ternary chain in a `useMemo` in
// `src/app/page.tsx`. Extracted to a pure helper so the priority
// ladder is unit-testable in isolation and the page JSX stays a
// flat render of the precomputed string.

/**
 * Build the dashboard header subtitle naming the model the agent
 * will use. Returns one of:
 *
 *   - `"<model>"` or `"<model> · <provider>"` when `diskModel` is set
 *   - `"<registryLabel> · registry default (not yet applied)"`
 *     when the disk is empty but the registry has a default
 *   - `"-"` when neither is set
 *
 * The 3 cases are mutually exclusive; the helper returns the first
 * match. Pure function — no I/O, no React.
 *
 * @param diskModel      - The `model` field from `config.yaml` (or `""` if absent)
 * @param diskProvider   - The `provider` field from `config.yaml` (or `""` if absent)
 * @param registryLabel  - The "default agent" model from the Models
 *                         registry, or `null` if no default is set
 *
 * @example
 *   formatModelSubtitle("gpt-4o", "openai", null)
 *   // => "gpt-4o · openai"
 *   formatModelSubtitle("", "", "claude-3-5-sonnet")
 *   // => "claude-3-5-sonnet · registry default (not yet applied)"
 *   formatModelSubtitle("", "", null)
 *   // => "-"
 */
export function formatModelSubtitle(
  diskModel: string,
  diskProvider: string,
  registryLabel: string | null,
): string {
  if (diskModel) {
    return diskProvider ? `${diskModel} · ${diskProvider}` : diskModel;
  }
  if (registryLabel) {
    return `${registryLabel} · registry default (not yet applied)`;
  }
  return "-";
}
