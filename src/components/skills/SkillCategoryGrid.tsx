// ── SkillCategoryGrid — grouped grid of SkillCards with collapsible category
// labels. Extracted verbatim from app/operations/skills/page.tsx. CategoryLabel
// is private to the grid, so it's co-located here.

import { ChevronRight } from "lucide-react";
import type { Skill } from "@/types/console";
import { SkillCard } from "@/components/skills/SkillCard";

interface CategoryLabelProps {
  category: string;
  count: number;
  accentColor: string;
  collapsed: boolean;
  onToggle: () => void;
}

function CategoryLabel({ category, count, accentColor, collapsed, onToggle }: CategoryLabelProps) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-2 group cursor-pointer py-0.5"
      title={collapsed ? `Expand ${category}` : `Collapse ${category}`}
    >
      <ChevronRight
        className={`w-3 h-3 flex-shrink-0 text-white/20 group-hover:text-ps-text-muted transition-all ${
          collapsed ? "" : "rotate-90"
        }`}
      />
      <span className={`text-xs font-mono font-semibold uppercase tracking-widest ${accentColor}`}>
        {category}
      </span>
      <span className={`text-xs font-mono ${accentColor}`}>
        ({count})
      </span>
      <div className={`h-px flex-1 bg-gradient-to-r from-white/10 to-transparent ${accentColor.replace(/\/\d+$/, "/5")}`} />
    </button>
  );
}

export interface SkillCategoryGridProps {
  categories: Array<{ category: string; skills: Skill[] }>;
  categoryCollapsed: Record<string, boolean>;
  onToggleCategory: (cat: string) => void;
  accentColor: string;
  enabled: boolean;
  expandedSkill: string | null;
  skillContent: string;
  toggling: Record<string, boolean>;
  onToggleSkill: (skill: Skill) => void;
  onViewSkill: (skill: Skill) => void;
  onEditSkill: (skill: Skill) => void;
}

export function SkillCategoryGrid({
  categories,
  categoryCollapsed,
  onToggleCategory,
  accentColor,
  enabled,
  expandedSkill,
  skillContent,
  toggling,
  onToggleSkill,
  onViewSkill,
  onEditSkill,
}: SkillCategoryGridProps) {
  return (
    <div className="space-y-5">
      {categories.map(({ category, skills }) => {
        const isCollapsed = categoryCollapsed[category];
        return (
          <div key={category}>
            <CategoryLabel
              category={category}
              count={skills.length}
              accentColor={accentColor}
              collapsed={isCollapsed}
              onToggle={() => onToggleCategory(category)}
            />
            {!isCollapsed && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-2">
                {skills.map((skill) => (
                  <SkillCard
                    key={skill.name}
                    skill={skill}
                    enabled={enabled}
                    isExpanded={expandedSkill === skill.name}
                    isPending={skill.name in toggling}
                    onToggle={() => onToggleSkill(skill)}
                    onView={() => onViewSkill(skill)}
                    onEdit={() => onEditSkill(skill)}
                    expandedContent={
                      expandedSkill === skill.name ? skillContent : undefined
                    }
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
