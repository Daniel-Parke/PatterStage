// ── SkillSection — a collapsible Active/Inactive section with a header.
//
// The per-section search box that used to sit in this header is gone (T-0032).
// Two boxes meant two half-catalogue searches, and neither could answer "where
// is that skill" without knowing its state first. One catalogue-wide box now
// lives above both sections, on the page.

import { ChevronRight, type LucideIcon } from "lucide-react";
import Badge from "@/components/ui/Badge";

export interface SkillSectionProps {
  title: string;
  icon: LucideIcon;
  iconColor: string;
  /** Skills in this section. */
  count: number;
  /** Categories they fall into, named in the header so the shape is visible collapsed. */
  categoryCount: number;
  collapsed: boolean;
  onToggleCollapse: () => void;
  children: React.ReactNode;
}

export function SkillSection({
  title,
  icon: Icon,
  iconColor,
  count,
  categoryCount,
  collapsed,
  onToggleCollapse,
  children,
}: SkillSectionProps) {
  return (
    <div>
      {/* Section header */}
      <button
        type="button"
        onClick={onToggleCollapse}
        className="w-full flex items-center justify-between mb-3 px-4 py-2.5 rounded-xl border border-white/10 bg-dark-900/40 hover:bg-dark-900/80 hover:border-white/20 transition-all cursor-pointer group"
      >
        <div className="flex items-center gap-2.5">
          <Icon className={`w-4 h-4 ${iconColor}`} />
          <span className="text-sm font-semibold text-ps-text-primary">{title}</span>
          <Badge color={count > 0 ? "green" : "gray"} size="sm">
            {count}
          </Badge>
          <span className="text-xs font-mono text-ps-text-faint">
            {categoryCount} categor{categoryCount === 1 ? "y" : "ies"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-ps-text-faint group-hover:text-ps-text-muted transition-colors">
            {collapsed ? "expand" : "collapse"}
          </span>
          <ChevronRight
            className={`w-4 h-4 text-ps-text-muted group-hover:text-ps-text-secondary transition-all ${
              collapsed ? "" : "rotate-90"
            }`}
          />
        </div>
      </button>

      {!collapsed && children}
    </div>
  );
}
