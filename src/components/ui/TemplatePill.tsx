// ═══════════════════════════════════════════════════════════════
// TemplatePill — Compact `TemplateCard` wrapper for dashboard
// quick-launch strips + the missions list's category groupings
// ═══════════════════════════════════════════════════════════════
//
// Takes the widest available template type (`TemplateLike`) so every call
// site can share it without a per-site type cast.

import TemplateCard from "@/components/ui/TemplateCard";
import type { TemplateLike } from "@/lib/missions/mission-categories";

export interface TemplatePillProps {
  /** The template to render as a compact pill. */
  t: TemplateLike;
  /** Called when the user clicks the pill. */
  onSelect: () => void;
}

/** Render a single template as a compact pill (`<TemplateCard compact />`). */
export default function TemplatePill({ t, onSelect }: TemplatePillProps) {
  // The `??` defaults exist to satisfy `TemplateCard`'s `string` prop types
  // when `t` is a `TemplateLike` with optional fields; `name ?? t.id` is the
  // one that changes what renders.
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
