// ── SkillSection — a collapsible Active/Inactive section with a header.
//
// The per-section search box that used to sit in this header is gone (T-0032).
// Two boxes meant two half-catalogue searches, and neither could answer "where
// is that skill" without knowing its state first. One catalogue-wide box now
// lives above both sections, on the page.

import { ChevronRight, type LucideIcon } from "lucide-react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";

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
      <Button
        variant="secondary"
        size="md"
        aria-expanded={!collapsed}
        onClick={onToggleCollapse}
        className="group mb-3 w-full justify-between"
      >
        <span className="flex items-center gap-2.5">
          <Icon className={`h-4 w-4 ${iconColor}`} aria-hidden="true" />
          <span className="font-semibold text-ps-text-primary">{title}</span>
          <Badge color={count > 0 ? "green" : "gray"} size="sm">
            {count}
          </Badge>
          <span className="font-mono text-micro text-ps-text-faint">
            {categoryCount} categor{categoryCount === 1 ? "y" : "ies"}
          </span>
        </span>
        <span className="flex items-center gap-2">
          <span className="text-body text-ps-text-faint transition-colors group-hover:text-ps-text-muted">
            {collapsed ? "expand" : "collapse"}
          </span>
          <ChevronRight
            className={`h-4 w-4 text-ps-text-muted transition-transform ${collapsed ? "" : "rotate-90"}`}
            aria-hidden="true"
          />
        </span>
      </Button>

      {!collapsed && children}
    </div>
  );
}
