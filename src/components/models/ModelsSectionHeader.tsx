// ═══════════════════════════════════════════════════════════════
// ModelsSectionHeader — shared per-section H2 header for /config/models
// ═══════════════════════════════════════════════════════════════
//
// The heading's typography used to be spelled out here, and in nine other
// spellings elsewhere; it is one constant with one reason now (T-0119). The row
// layout stays at the call site, because where a heading sits is not part of
// what a heading IS.
//
// The component does NOT render the outer <section> wrapper — each section
// component keeps ownership of its own data-section attribute + space-y-4
// (matches CollapsibleSection's pattern of not owning its wrapper).

import type { LucideIcon } from "lucide-react";
import type { AccentColor } from "@/types/console";
import { iconColorMap, iconMutedColorMap, sectionHeadingClasses } from "@/lib/ui/theme";

type ModelsSectionHeaderTone = "full" | "muted";

export interface ModelsSectionHeaderProps {
  /** Lucide icon component reference (matches CONFIG_SECTIONS pattern). */
  icon: LucideIcon;
  /** Section title text (rendered uppercase via CSS). */
  title: string;
  /** Accent color — picks the icon's neon token via `iconColorMap`. */
  color: AccentColor;
  /**
   * Icon opacity variant:
   *   - "full"  → `text-neon-{color}` (default, 100% opacity)
   *   - "muted" → `text-neon-{color}/60` (60% opacity)
   */
  iconTone?: ModelsSectionHeaderTone;
}

export default function ModelsSectionHeader({
  icon: Icon,
  title,
  color,
  iconTone = "full",
}: ModelsSectionHeaderProps) {
  // A whole class from a map, not two interpolations touching: `${cls}${"/60"}`
  // assembles `text-neon-purple/60` at runtime, and Tailwind, which scans
  // source, generates no such rule. It worked only because a unit test wrote
  // the class name down (T-0120).
  const iconClass = iconTone === "muted" ? iconMutedColorMap[color] : iconColorMap[color];
  return (
    <h2 className={`${sectionHeadingClasses} flex items-center gap-2`}>
      <Icon className={`w-4 h-4 ${iconClass}`} />
      {title}
    </h2>
  );
}
