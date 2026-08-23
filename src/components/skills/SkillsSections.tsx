// ── SkillsSections — the Active and Inactive halves of the Skills Manager.
// Extracted verbatim from app/operations/skills/page.tsx. The two sections
// are the same shape with different accents, counts and empty-state copy, so
// they share one private panel here and the page passes the difference in.
//
// Presentation only: every piece of state stays on the page.
//
// The two grids differ in one substantive way. Active calls
// `onToggleSkill(skill)` and takes the page helper's default fallback,
// `skill.enabled`. Inactive calls `onToggleSkill(skill, !skill.enabled)`,
// because the Inactive list is the negation of the active state: a skill
// listed here has `enabled === false`, so the "current enabled" the page's
// toggleSkill reads must be the inversion, or the toggle no-ops against
// the wrong current state. That was true of the page's inline callbacks
// before the split and is preserved exactly.

"use client";

import { ToggleLeft, ToggleRight, type LucideIcon } from "lucide-react";
import { SearchInput } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/LoadingSpinner";
import { SkillSection } from "@/components/skills/SkillSection";
import { SkillCategoryGrid } from "@/components/skills/SkillCategoryGrid";
import { groupCategories } from "@/lib/skills-page-helpers";
import type { Skill } from "@/types/console";

interface SkillsSectionPanelProps {
  title: string;
  icon: LucideIcon;
  iconColor: string;
  accentColor: string;
  enabled: boolean;
  searchAccent: "green" | "white";
  searchPlaceholder: string;
  emptyTitle: string;
  emptyWithSearch: string;
  emptyWithoutSearch: string;
  skills: Skill[];
  ofTotal: number;
  search: string;
  onSearchChange: (value: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  categoryCollapsed: Record<string, boolean>;
  onToggleCategory: (cat: string) => void;
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
  enabled,
  searchAccent,
  searchPlaceholder,
  emptyTitle,
  emptyWithSearch,
  emptyWithoutSearch,
  skills,
  ofTotal,
  search,
  onSearchChange,
  collapsed,
  onToggleCollapse,
  categoryCollapsed,
  onToggleCategory,
  expandedSkill,
  skillContent,
  toggling,
  onToggleSkill,
  onViewSkill,
  onEditSkill,
}: SkillsSectionPanelProps) {
  return (
    <SkillSection
      title={title}
      icon={icon}
      iconColor={iconColor}
      count={skills.length}
      ofTotal={ofTotal}
      collapsed={collapsed}
      onToggleCollapse={onToggleCollapse}
      search={
        <SearchInput
          value={search}
          onChange={onSearchChange}
          placeholder={searchPlaceholder}
          accentColor={searchAccent}
        />
      }
    >
      {skills.length === 0 ? (
        <EmptyState
          icon={icon}
          title={emptyTitle}
          description={search ? emptyWithSearch : emptyWithoutSearch}
        />
      ) : (
        <SkillCategoryGrid
          categories={groupCategories(skills)}
          categoryCollapsed={categoryCollapsed}
          onToggleCategory={onToggleCategory}
          accentColor={accentColor}
          enabled={enabled}
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
  activeTotal: number;
  activeSearch: string;
  onActiveSearchChange: (value: string) => void;
  activeCollapsed: boolean;
  onToggleActiveCollapsed: () => void;
  inactiveSkills: Skill[];
  inactiveTotal: number;
  inactiveSearch: string;
  onInactiveSearchChange: (value: string) => void;
  inactiveCollapsed: boolean;
  onToggleInactiveCollapsed: () => void;
  categoryCollapsed: Record<string, boolean>;
  onToggleCategory: (cat: string) => void;
  expandedSkill: string | null;
  skillContent: string;
  toggling: Record<string, boolean>;
  onToggleSkill: (skill: Skill, fallback?: boolean) => void;
  onViewSkill: (skill: Skill) => void;
  onEditSkill: (skill: Skill) => void;
}

export default function SkillsSections({
  activeSkills,
  activeTotal,
  activeSearch,
  onActiveSearchChange,
  activeCollapsed,
  onToggleActiveCollapsed,
  inactiveSkills,
  inactiveTotal,
  inactiveSearch,
  onInactiveSearchChange,
  inactiveCollapsed,
  onToggleInactiveCollapsed,
  categoryCollapsed,
  onToggleCategory,
  expandedSkill,
  skillContent,
  toggling,
  onToggleSkill,
  onViewSkill,
  onEditSkill,
}: SkillsSectionsProps) {
  const shared = {
    categoryCollapsed,
    onToggleCategory,
    expandedSkill,
    skillContent,
    toggling,
    onViewSkill,
    onEditSkill,
  };

  return (
    <div className="flex flex-col gap-6">
      {/* ── Active Skills ── */}
      <SkillsSectionPanel
        {...shared}
        title="Active"
        icon={ToggleRight}
        iconColor="text-neon-green"
        accentColor="text-neon-green/70"
        enabled
        searchAccent="green"
        searchPlaceholder="Search active skills..."
        emptyTitle="No active skills"
        emptyWithSearch="No active skills match your search"
        emptyWithoutSearch="Toggle skills below to enable them"
        skills={activeSkills}
        ofTotal={activeTotal}
        search={activeSearch}
        onSearchChange={onActiveSearchChange}
        collapsed={activeCollapsed}
        onToggleCollapse={onToggleActiveCollapsed}
        onToggleSkill={onToggleSkill}
      />

      {/* ── Inactive Skills ── */}
      <SkillsSectionPanel
        {...shared}
        title="Inactive"
        icon={ToggleLeft}
        iconColor="text-ps-text-muted"
        accentColor="text-ps-text-muted"
        enabled={false}
        searchAccent="white"
        searchPlaceholder="Search inactive skills..."
        emptyTitle="No inactive skills"
        emptyWithSearch="No inactive skills match your search"
        emptyWithoutSearch="All skills are currently active"
        skills={inactiveSkills}
        ofTotal={inactiveTotal}
        search={inactiveSearch}
        onSearchChange={onInactiveSearchChange}
        collapsed={inactiveCollapsed}
        onToggleCollapse={onToggleInactiveCollapsed}
        onToggleSkill={(skill) => onToggleSkill(skill, !skill.enabled)}
      />
    </div>
  );
}
