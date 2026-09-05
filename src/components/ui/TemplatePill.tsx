// ═══════════════════════════════════════════════════════════════
// TemplatePill — Compact `TemplateCard` wrapper for dashboard
// quick-launch strips + the missions list's category groupings
// ═══════════════════════════════════════════════════════════════
//
// The "compact pill" form of `TemplateCard` (the small icon + name
// button used in the dashboard's collapsed dispatch strip, the
// dashboard's expanded dispatch panel, and the missions list's
// category accordion) was duplicated as 9-line `<TemplateCard
// ... />` JSX blocks at 3 sites. The shape is the same at every
// site: `id` + `name` + `icon` + `color` + `description` +
// `isCustom` + `compact` + an `onSelect` callback. The ONLY
// variation was `?? <default>` for the optional `TemplateLike`
// fields, applied only at the 1 site whose `t` was typed
// `TemplateLike` (where every field is `?`-optional):
//
//   - `src/app/page.tsx:559-569` — collapsed strip (TemplateListItem, all required)
//   - `src/app/page.tsx:596-606` — expanded panel (TemplateLike, all optional)
//   - `src/components/missions/MissionsList.tsx:187-197` — category
//     accordion (MissionTemplate & { categoryId? }, all required)
//
// `TemplatePill` is a one-liner wrapper that takes the widest
// available template type (`TemplateLike`) and forwards to
// `TemplateCard` with the single meaningful default applied:
// `name ?? t.id` (the only default `TemplateCard`'s compact form
// does NOT handle internally — its `iconMap[icon] || Zap` and
// `iconColorMap[color] || "text-neon-cyan"` fallbacks cover the
// icon + color cases, and the compact form doesn't render
// `description` at all).
//
// Byte-equivalence claim:
// - At sites 1 and 3 (all-required input types), `t.name` is always
//   defined, so `t.name ?? t.id` is a literal `t.name`. The
//   `<TemplateCard name={t.name} ... />` is identical to the
//   pre-refactor inline form.
// - At site 2 (TemplateLike), the pre-refactor code applied
//   `name ?? t.id`, `icon ?? "Zap"`, `color ?? "cyan"`, and
//   `description ?? ""` per field. `TemplatePill` applies only
//   `name ?? t.id` and forwards `icon`/`color`/`description`
//   unchanged. This is byte-equivalent to the pre-refactor code
//   because `TemplateCard`'s compact form has its OWN
//   `iconMap[icon] || Zap` and `iconColorMap[color] || "text-neon-cyan"`
//   fallbacks (src/components/ui/TemplateCard.tsx:41 + :48) — the
//   pre-refactor `?? "Zap"` / `?? "cyan"` are no-ops, the
//   `TemplateCard` always falls back to `Zap` / `text-neon-cyan`
//   for unknown icon/color values. The `?? ""` for description is
//   also a no-op for the compact form, which doesn't render
//   description at all (src/components/ui/TemplateCard.tsx:46-54).

import TemplateCard from "@/components/ui/TemplateCard";
import type { TemplateLike } from "@/lib/missions/mission-categories";

export interface TemplatePillProps {
  /** The template to render as a compact pill. Accepts the wider
   *  `TemplateLike` shape so all 3 call sites can share the same
   *  component without a per-site type cast. The only field read
   *  is `name` (with `t.id` as the only meaningful default). */
  t: TemplateLike;
  /** Called when the user clicks the pill. */
  onSelect: () => void;
}

/**
 * Render a single template as a compact pill (`<TemplateCard compact />`).
 * Pre-refactor 3-site helper — collapses 3 × 9-line JSX blocks to
 * 3 × 1-line helper calls.
 */
export default function TemplatePill({ t, onSelect }: TemplatePillProps) {
  // The `??` defaults for icon/color/description are no-ops at the 2
  // all-required-input sites (TemplatesListItem + MissionTemplate both
  // have `icon: string` etc., not `icon?: string`) but are required at
  // the 1 TemplateLike site (where all 4 fields are `?`-optional) to
  // satisfy `TemplateCard`'s `string` prop types. The `name ?? t.id`
  // default is the one that actually changes the rendered output (the
  // pre-refactor TemplateLike site already applied this exact default).
  return (
    <TemplateCard
      id={t.id}
      name={t.name ?? t.id}
      icon={t.icon ?? "Zap"}
      color={t.color ?? "cyan"}
      description={t.description ?? ""}
      isCustom={t.isCustom}
      compact
      onSelect={onSelect}
    />
  );
}
