// ── SkillsSections — the Active and Inactive halves of the Skills page.
//
// The two sections are the same shape with different accents and empty-state
// copy, so they share one private panel here and the page passes the
// difference in. Presentation only: every piece of state stays on the page.
//
// What changed in T-0032. Each section used to render a grid of every card it
// held, all categories open, both sections at once: 178 cards, 5,450 DOM nodes
// and 625 buttons on load. A section is now a list of category ROWS, and only
// an open category renders a page window of skills.
//
// What changed in T-0125. A section small enough to render in full opens with
// its categories expanded (see categoriesOpenByDefault), and an EMPTY Inactive
// section is not drawn at all: on a profile with everything enabled it was a
// header row and a 330px empty state under the list, saying nothing a reader
// could act on. An empty Active section is still drawn, because enabling a
// skill is what this screen is for and its empty state says how.

"use client";

import { ToggleLeft, ToggleRight, type LucideIcon } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkillSection } from "@/components/skills/SkillSection";
import { SkillCategoryList } from "@/components/skills/SkillCategoryList";
import { categoriesOpenByDefault, groupCategories } from "@/lib/skills-page-helpers";
import type { Skill } from "@/types/console";

interface SkillsSectionPanelProps {
  title: string;
  icon: LucideIcon;
  iconColor: string;
  accentColor: string;
  scope: string;
  emptyTitle: string;
  emptyDescription: string;
  skills: Skill[];
  collapsed: boolean;
  onToggleCollapse: () => void;
  expandedCategories: Record<string, boolean>;
  onToggleCategory: (stateKey: string, expandedNow: boolean) => void;
  categoryPage: Record<string, number>;
  onCategoryPageChange: (stateKey: string, page: number) => void;
  expandedSkill: string | null;
  skillContent: string;
  toggling: Record<string, boolean>;
  onToggleSkill: (skill: Skill) => void;
  onViewSkill: (skill: Skill) => void;
  onEditSkill: (skill: Skill) => void;
}

function SkillsSectionPanel({
  title,
  icon,
  iconColor,
  accentColor,
  scope,
  emptyTitle,
  emptyDescription,
  skills,
  collapsed,
  onToggleCollapse,
  expandedCategories,
  onToggleCategory,
  categoryPage,
  onCategoryPageChange,
  expandedSkill,
  skillContent,
  toggling,
  onToggleSkill,
  onViewSkill,
  onEditSkill,
}: SkillsSectionPanelProps) {
  const categories = groupCategories(skills);

  return (
    <SkillSection
      title={title}
      icon={icon}
      iconColor={iconColor}
      count={skills.length}
      categoryCount={categories.length}
      collapsed={collapsed}
      onToggleCollapse={onToggleCollapse}
    >
      {skills.length === 0 ? (
        <EmptyState icon={icon} title={emptyTitle} description={emptyDescription} />
      ) : (
        <SkillCategoryList
          categories={categories}
          scope={scope}
          openByDefault={categoriesOpenByDefault(skills.length)}
          expandedCategories={expandedCategories}
          onToggleCategory={onToggleCategory}
          categoryPage={categoryPage}
          onCategoryPageChange={onCategoryPageChange}
          accentColor={accentColor}
          expandedSkill={expandedSkill}
          skillContent={skillContent}
          toggling={toggling}
          onToggleSkill={onToggleSkill}
          onViewSkill={onViewSkill}
          onEditSkill={onEditSkill}
        />
      )}
    </SkillSection>
  );
}

export interface SkillsSectionsProps {
  activeSkills: Skill[];
  activeCollapsed: boolean;
  onToggleActiveCollapsed: () => void;
  inactiveSkills: Skill[];
  inactiveCollapsed: boolean;
  onToggleInactiveCollapsed: () => void;
  expandedCategories: Record<string, boolean>;
  onToggleCategory: (stateKey: string, expandedNow: boolean) => void;
  categoryPage: Record<string, number>;
  onCategoryPageChange: (stateKey: string, page: number) => void;
  expandedSkill: string | null;
  skillContent: string;
  toggling: Record<string, boolean>;
  onToggleSkill: (skill: Skill) => void;
  onViewSkill: (skill: Skill) => void;
  onEditSkill: (skill: Skill) => void;
}

export default function SkillsSections({
  activeSkills,
  activeCollapsed,
  onToggleActiveCollapsed,
  inactiveSkills,
  inactiveCollapsed,
  onToggleInactiveCollapsed,
  expandedCategories,
  onToggleCategory,
  categoryPage,
  onCategoryPageChange,
  expandedSkill,
  skillContent,
  toggling,
  onToggleSkill,
  onViewSkill,
  onEditSkill,
}: SkillsSectionsProps) {
  const shared = {
    expandedCategories,
    onToggleCategory,
    categoryPage,
    onCategoryPageChange,
    expandedSkill,
    skillContent,
    toggling,
    onToggleSkill,
    onViewSkill,
    onEditSkill,
  };

  return (
    <div className="flex flex-col gap-6">
      <SkillsSectionPanel
        {...shared}
        title="Active"
        icon={ToggleRight}
        iconColor="text-neon-green"
        accentColor="text-neon-green/70"
        scope="active"
        emptyTitle="No active skills"
        emptyDescription="Turn a skill on below to enable it for this profile"
        skills={activeSkills}
        collapsed={activeCollapsed}
        onToggleCollapse={onToggleActiveCollapsed}
      />

      {inactiveSkills.length > 0 && (
        <SkillsSectionPanel
          {...shared}
          title="Inactive"
          icon={ToggleLeft}
          iconColor="text-ps-text-muted"
          accentColor="text-ps-text-muted"
          scope="inactive"
          emptyTitle="No inactive skills"
          emptyDescription="All skills are currently active"
          skills={inactiveSkills}
          collapsed={inactiveCollapsed}
          onToggleCollapse={onToggleInactiveCollapsed}
        />
      )}
    </div>
  );
}
