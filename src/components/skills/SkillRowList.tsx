// ── SkillRowList — one page window of SkillRows, plus its pager.
//
// The single render unit for skill rows (T-0032). A category body uses it and
// so does the search-results panel, which is what keeps "how many rows can be
// on screen at once" a property of ONE component rather than a thing each
// caller decides for itself.
//
// It is handed the FULL list for its bucket, not a pre-sliced page, so it can
// say how many rows there really are. Slicing is the last thing that happens,
// here, after the search has already run over the whole catalogue.
//
// Rows, not a grid of cards, since T-0125: a skill is a name, a line about
// it, a switch and two doors, and a row of those is 44px where a card was 150.

"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Button from "@/components/ui/Button";
import { Panel } from "@/components/dashboard/Panel";
import { SkillRow } from "@/components/skills/SkillRow";
import {
  effectiveSkillEnabled,
  pageCount,
  pageRangeLabel,
  pageSlice,
} from "@/lib/skills-page-helpers";
import type { Skill } from "@/types/console";

export interface SkillRowListProps {
  /** Every skill in this bucket. The window is taken here, not by the caller. */
  skills: Skill[];
  page: number;
  onPageChange: (page: number) => void;
  toggling: Record<string, boolean>;
  expandedSkill: string | null;
  skillContent: string;
  onToggleSkill: (skill: Skill) => void;
  onViewSkill: (skill: Skill) => void;
  onEditSkill: (skill: Skill) => void;
  /** Name each row's category: the search results, where the rows are out of theirs. */
  showCategory?: boolean;
}

export function SkillRowList({
  skills,
  page,
  onPageChange,
  toggling,
  expandedSkill,
  skillContent,
  onToggleSkill,
  onViewSkill,
  onEditSkill,
  showCategory = false,
}: SkillRowListProps) {
  const pages = pageCount(skills.length);
  const rows = pageSlice(skills, page);
  const atFirst = page <= 0;
  const atLast = page >= pages - 1;

  return (
    <div className="space-y-3">
      <Panel className="divide-y divide-ps-edge-hairline">
        {rows.map((skill) => (
          <SkillRow
            key={skill.name}
            skill={skill}
            // Per skill, never per section. The Inactive grid used to pass a
            // negated fallback down instead, which meant the toggle on an
            // inactive skill computed its "current" state as ENABLED.
            enabled={effectiveSkillEnabled(skill, toggling)}
            isExpanded={expandedSkill === skill.name}
            isPending={skill.name in toggling}
            showCategory={showCategory}
            onToggle={() => onToggleSkill(skill)}
            onView={() => onViewSkill(skill)}
            onEdit={() => onEditSkill(skill)}
            expandedContent={expandedSkill === skill.name ? skillContent : undefined}
          />
        ))}
      </Panel>

      {pages > 1 && (
        <div className="flex items-center justify-between gap-3 pt-1">
          <span className="font-mono text-micro text-ps-text-muted" data-testid="skill-page-status">
            {pageRangeLabel(skills.length, page)}
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              icon={ChevronLeft}
              data-testid="skill-page-prev"
              onClick={() => onPageChange(page - 1)}
              disabled={atFirst}
            >
              Prev
            </Button>
            <span className="font-mono text-micro text-ps-text-faint">
              {page + 1}/{pages}
            </span>
            <Button
              size="sm"
              variant="secondary"
              data-testid="skill-page-next"
              onClick={() => onPageChange(page + 1)}
              disabled={atLast}
            >
              Next <ChevronRight className="h-3 w-3" aria-hidden="true" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
