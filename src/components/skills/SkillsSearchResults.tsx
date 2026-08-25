// ── SkillsSearchResults — what one catalogue-wide search box returns.
//
// The whole point of this panel (T-0032, INV-1). The catalogue is normally a
// list of collapsed categories, and a paged surface that filters only the rows
// it has rendered would report "no matches" for a skill sitting three pages
// deep inside a category nobody has opened. So search does not filter the
// view: it runs over the whole catalogue and REPLACES the view with its
// matches, active and inactive together, flat and paginated.
//
// Flat is deliberate. Re-grouping the matches would put every hit back behind
// a category the user then has to open, which is the wall the restructure took
// down. Each card names its own category, so the context is not lost.

"use client";

import { Search } from "lucide-react";
import { EmptyState } from "@/components/ui/LoadingSpinner";
import { SkillRowList } from "@/components/skills/SkillRowList";
import type { Skill } from "@/types/console";

export interface SkillsSearchResultsProps {
  /** Every match in the catalogue, not the page window. */
  matches: Skill[];
  /** Catalogue size, so the panel can say what was searched. */
  total: number;
  page: number;
  onPageChange: (page: number) => void;
  toggling: Record<string, boolean>;
  expandedSkill: string | null;
  skillContent: string;
  onToggleSkill: (skill: Skill) => void;
  onViewSkill: (skill: Skill) => void;
  onEditSkill: (skill: Skill) => void;
}

export default function SkillsSearchResults({
  matches,
  total,
  page,
  onPageChange,
  toggling,
  expandedSkill,
  skillContent,
  onToggleSkill,
  onViewSkill,
  onEditSkill,
}: SkillsSearchResultsProps) {
  return (
    <div className="space-y-3">
      <p
        className="text-xs font-mono text-ps-text-muted"
        data-testid="skills-search-summary"
      >
        {matches.length} {matches.length === 1 ? "match" : "matches"} across all{" "}
        {total} skills
      </p>

      {matches.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No skills match"
          description="Search covers every skill in the catalogue, active and inactive, by name and description."
        />
      ) : (
        <SkillRowList
          skills={matches}
          page={page}
          onPageChange={onPageChange}
          toggling={toggling}
          expandedSkill={expandedSkill}
          skillContent={skillContent}
          onToggleSkill={onToggleSkill}
          onViewSkill={onViewSkill}
          onEditSkill={onEditSkill}
        />
      )}
    </div>
  );
}
