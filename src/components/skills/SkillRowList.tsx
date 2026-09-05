// ── SkillRowList — one page window of SkillCards, plus its pager.
//
// The single render unit for skill rows (T-0032). A category body uses it and
// so does the search-results panel, which is what keeps "how many rows can be
// on screen at once" a property of ONE component rather than a thing each
// caller decides for itself.
//
// It is handed the FULL list for its bucket, not a pre-sliced page, so it can
// say how many rows there really are. Slicing is the last thing that happens,
// here, after the search has already run over the whole catalogue.

"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { SkillCard } from "@/components/skills/SkillCard";
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
}: SkillRowListProps) {
  const pages = pageCount(skills.length);
  const rows = pageSlice(skills, page);
  const atFirst = page <= 0;
  const atLast = page >= pages - 1;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {rows.map((skill) => (
          <SkillCard
            key={skill.name}
            skill={skill}
            // Per skill, never per section. The Inactive grid used to pass a
            // negated fallback down instead, which meant the toggle on an
            // inactive skill computed its "current" state as ENABLED and so
            // asked the API to disable an already-disabled skill. Reading the
            // effective state of the skill in front of you has no such trap,
            // and it is the only thing that works for a mixed search-results
            // list where the two states sit side by side.
            enabled={effectiveSkillEnabled(skill, toggling)}
            isExpanded={expandedSkill === skill.name}
            isPending={skill.name in toggling}
            onToggle={() => onToggleSkill(skill)}
            onView={() => onViewSkill(skill)}
            onEdit={() => onEditSkill(skill)}
            expandedContent={expandedSkill === skill.name ? skillContent : undefined}
          />
        ))}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between gap-3 pt-1">
          <span
            className="text-xs font-mono text-ps-text-muted"
            data-testid="skill-page-status"
          >
            {pageRangeLabel(skills.length, page)}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="skill-page-prev"
              onClick={() => onPageChange(page - 1)}
              disabled={atFirst}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-white/10 text-ps-text-muted hover:border-white/20 hover:text-ps-text-secondary transition-all disabled:opacity-30 disabled:hover:border-white/10 disabled:hover:text-ps-text-muted"
            >
              <ChevronLeft className="w-3 h-3" /> Prev
            </button>
            <span className="text-xs font-mono text-ps-text-faint">
              {page + 1}/{pages}
            </span>
            <button
              type="button"
              data-testid="skill-page-next"
              onClick={() => onPageChange(page + 1)}
              disabled={atLast}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-white/10 text-ps-text-muted hover:border-white/20 hover:text-ps-text-secondary transition-all disabled:opacity-30 disabled:hover:border-white/10 disabled:hover:text-ps-text-muted"
            >
              Next <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
