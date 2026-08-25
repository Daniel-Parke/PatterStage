// ── SkillCategoryList — the catalogue as a scannable list of categories.
//
// Replaces SkillCategoryGrid (T-0032), which rendered every category's cards
// unconditionally. A category is a ROW until someone opens it; opening one
// renders a single page window of its skills through SkillRowList.
//
// Collapse and paging state live on the page, keyed by `categoryStateKey`,
// because "Other" exists in both the Active and the Inactive section and the
// two must not share a key. The state key is built from the group's
// case-normalised `key`, never from the title-cased display label: the page
// used to seed collapse state under the API's raw category strings and read it
// back under the display label, so every category rendered open regardless of
// what the map said. Keying off one value produced by the grouping itself is
// what stops that returning.

"use client";

import { ChevronRight } from "lucide-react";
import { SkillRowList } from "@/components/skills/SkillRowList";
import { categoryStateKey, type SkillCategoryGroup } from "@/lib/skills-page-helpers";
import type { Skill } from "@/types/console";

interface CategoryRowProps {
  category: string;
  count: number;
  accentColor: string;
  expanded: boolean;
  onToggle: () => void;
}

function CategoryRow({ category, count, accentColor, expanded, onToggle }: CategoryRowProps) {
  return (
    <button
      type="button"
      data-testid="skill-category-row"
      onClick={onToggle}
      className="w-full flex items-center gap-2 group cursor-pointer py-1"
      title={expanded ? `Collapse ${category}` : `Expand ${category}`}
    >
      <ChevronRight
        className={`w-3 h-3 flex-shrink-0 text-ps-text-faint group-hover:text-ps-text-muted transition-all ${
          expanded ? "rotate-90" : ""
        }`}
      />
      <span className={`text-xs font-mono font-semibold uppercase tracking-widest ${accentColor}`}>
        {category}
      </span>
      <span className={`text-xs font-mono ${accentColor}`}>({count})</span>
      <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
    </button>
  );
}

export interface SkillCategoryListProps {
  categories: SkillCategoryGroup[];
  /** "active" or "inactive". Namespaces this section's collapse and page state. */
  scope: string;
  expandedCategories: Record<string, boolean>;
  onToggleCategory: (stateKey: string) => void;
  categoryPage: Record<string, number>;
  onCategoryPageChange: (stateKey: string, page: number) => void;
  accentColor: string;
  expandedSkill: string | null;
  skillContent: string;
  toggling: Record<string, boolean>;
  onToggleSkill: (skill: Skill) => void;
  onViewSkill: (skill: Skill) => void;
  onEditSkill: (skill: Skill) => void;
}

export function SkillCategoryList({
  categories,
  scope,
  expandedCategories,
  onToggleCategory,
  categoryPage,
  onCategoryPageChange,
  accentColor,
  expandedSkill,
  skillContent,
  toggling,
  onToggleSkill,
  onViewSkill,
  onEditSkill,
}: SkillCategoryListProps) {
  return (
    <div className="space-y-3">
      {categories.map(({ key, category, skills }) => {
        const stateKey = categoryStateKey(scope, key);
        // Absence means collapsed. Default-collapsed is the SHAPE of the state
        // rather than something seeded on load, so a category that appears
        // after a profile switch, or one the seeding never knew about, is
        // collapsed like every other rather than open by accident.
        const expanded = expandedCategories[stateKey] === true;
        return (
          <div key={stateKey}>
            <CategoryRow
              category={category}
              count={skills.length}
              accentColor={accentColor}
              expanded={expanded}
              onToggle={() => onToggleCategory(stateKey)}
            />
            {expanded && (
              <div className="mt-2">
                <SkillRowList
                  skills={skills}
                  page={categoryPage[stateKey] ?? 0}
                  onPageChange={(p) => onCategoryPageChange(stateKey, p)}
                  toggling={toggling}
                  expandedSkill={expandedSkill}
                  skillContent={skillContent}
                  onToggleSkill={onToggleSkill}
                  onViewSkill={onViewSkill}
                  onEditSkill={onEditSkill}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
