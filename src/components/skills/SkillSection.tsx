// ── SkillSection — a collapsible Active/Inactive section with header + search ──
// Extracted verbatim from app/operations/skills/page.tsx.

import { ChevronRight, type LucideIcon } from "lucide-react";
import Badge from "@/components/ui/Badge";

export interface SkillSectionProps {
  title: string;
  icon: LucideIcon;
  iconColor: string;
  count: number;
  ofTotal: number;
  collapsed: boolean;
  onToggleCollapse: () => void;
  search: React.ReactNode;
  children: React.ReactNode;
}

export function SkillSection({
  title,
  icon: Icon,
  iconColor,
  count,
  ofTotal,
  collapsed,
  onToggleCollapse,
  search,
  children,
}: SkillSectionProps) {
  return (
    <div>
      {/* Section header */}
      <button
        onClick={onToggleCollapse}
        className="w-full flex items-center justify-between mb-3 px-4 py-2.5 rounded-xl border border-white/10 bg-dark-900/40 hover:bg-dark-900/80 hover:border-white/20 transition-all cursor-pointer group"
      >
        <div className="flex items-center gap-2.5">
          <Icon className={`w-4 h-4 ${iconColor}`} />
          <span className="text-sm font-semibold text-ps-text-primary">{title}</span>
          <Badge color={count > 0 ? "green" : "gray"} size="sm">
            {count}
            {count !== ofTotal ? `/${ofTotal}` : ""}
          </Badge>
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

      {/* Collapsible body */}
      {!collapsed && (
        <div className="space-y-3">
          {/* Section search */}
          <div className="max-w-xs">{search}</div>

          {/* Skill cards */}
          {children}
        </div>
      )}
    </div>
  );
}
