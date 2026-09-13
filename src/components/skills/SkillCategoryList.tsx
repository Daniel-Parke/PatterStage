// ── SkillCategoryList — the catalogue as a scannable list of categories.
//
// Replaces SkillCategoryGrid (T-0032), which rendered every category's cards
// unconditionally. A category is a ROW with a count; opening one renders a
// single page window of its skills through SkillRowList.
//
// Whether a row starts open is the section's decision (T-0125): a section
// small enough to render in full opens every category, and one beyond that
// collapses them. The page keeps only the EXCEPTIONS, keyed by
// `categoryStateKey`, because "Other" exists in both the Active and the
// Inactive section and the two must not share a key. The key is built from
// the group's case-normalised `key`, never from the title-cased display label:
// the page used to seed collapse state under the API's raw category strings
// and read it back under the display label, so every category rendered open
// regardless of what the map said.

"use client";

import { ChevronRight } from "lucide-react";
import Button from "@/components/ui/Button";
import { SkillRowList } from "@/components/skills/SkillRowList";
import { categoryStateKey, type SkillCategoryGroup } from "@/lib/skills/skills-page-helpers";
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
    <Button
      variant="ghost"
      size="sm"
      data-testid="skill-category-row"
      aria-expanded={expanded}
      onClick={onToggle}
      className="group -ml-2.5 w-[calc(100%+0.625rem)] justify-start"
      title={expanded ? `Collapse ${category}` : `Expand ${category}`}
    >
      <ChevronRight
        className={`h-3 w-3 shrink-0 text-ps-text-faint transition-transform group-hover:text-ps-text-muted ${
          expanded ? "rotate-90" : ""
        }`}
        aria-hidden="true"
      />
      <span className={`font-mono text-micro font-semibold uppercase tracking-widest ${accentColor}`}>
        {category}
      </span>
      <span className={`font-mono text-micro ${accentColor}`}>({count})</span>
      <span className="h-px flex-1 bg-ps-edge-hairline" aria-hidden="true" />
    </Button>
  );
}

export interface SkillCategoryListProps {
  categories: SkillCategoryGroup[];
  /** "active" or "inactive". Namespaces this section's collapse and page state. */
  scope: string;
  /** Whether a category with no override starts open. */
  openByDefault: boolean;
  expandedCategories: Record<string, boolean>;
  onToggleCategory: (stateKey: string, expandedNow: boolean) => void;
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
  openByDefault,
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
        // An entry is the exception to the default, whichever way the default
        // goes, so a category that appears after a profile switch takes the
        // default rather than being open or closed by accident.
        const override = expandedCategories[stateKey];
        const expanded = override === undefined ? openByDefault : override;
        return (
          <div key={stateKey}>
            <CategoryRow
              category={category}
              count={skills.length}
              accentColor={accentColor}
              expanded={expanded}
              onToggle={() => onToggleCategory(stateKey, expanded)}
            />
            {expanded && (
              <div className="mt-1">
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
