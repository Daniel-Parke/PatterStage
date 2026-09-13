// ═══════════════════════════════════════════════════════════════
// SkillRow — one skill as a ledger row
//
// Was SkillCard: a bordered tile of a name, a category, a two-line
// description, a status dot and three buttons, three to a row, roughly 150px
// each. A skill is a name, one line about it, a switch and two doors, which is
// a ROW - and a row is what lets seventy-eight of them fit on a screen that
// used to show none (T-0125, and WG-WEB-003 D: three comparable fields is a
// ledger, not a box).
//
// The switch is a real switch. It was a bare button around an icon, with a
// title and nothing a screen reader could read as on or off.
// ═══════════════════════════════════════════════════════════════

"use client";

import { ChevronDown, Edit3, X } from "lucide-react";

import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { InlineToggle } from "@/components/ui/Input";
import { LedgerRow } from "@/components/dashboard/LedgerRow";
import type { Skill } from "@/types/console";

export interface SkillRowProps {
  skill: Skill;
  enabled: boolean;
  isExpanded: boolean;
  isPending: boolean;
  /** Named on the row when the row is out of its category: the search results. */
  showCategory?: boolean;
  onToggle: () => void;
  onView: () => void;
  onEdit: () => void;
  expandedContent?: string;
}

export function SkillRow({
  skill,
  enabled,
  isExpanded,
  isPending,
  showCategory = false,
  onToggle,
  onView,
  onEdit,
  expandedContent,
}: SkillRowProps) {
  return (
    <LedgerRow
      data-testid="skill-row"
      data-skill={skill.name}
      className="flex flex-wrap items-center gap-x-3 gap-y-1"
    >
      <span
        className={`h-5 w-0.5 shrink-0 rounded-full ${enabled ? "bg-neon-green" : "bg-ps-edge-hairline"}`}
        aria-hidden="true"
      />
      <span className="shrink-0 font-mono text-body font-semibold text-ps-text-primary">{skill.name}</span>
      {showCategory && <span className="shrink-0 font-mono text-micro text-ps-text-faint">{skill.category}</span>}
      {isPending && (
        <Badge color="green" size="sm">
          Updating…
        </Badge>
      )}
      <span className="min-w-0 flex-1 truncate text-body text-ps-text-muted" title={skill.description}>
        {skill.description}
      </span>
      {/* No state word beside the switch: the switch says it, in its name
          ("Disable web-search"), its checked state and its tone, and the
          green mark at the row's start says it again; the word cost every row
          a line on a phone (the review of 2026-09-08, T-0132). */}
      <InlineToggle
        data-testid="skill-toggle"
        value={enabled}
        onChange={onToggle}
        disabled={isPending}
        color="green"
        label={`${enabled ? "Disable" : "Enable"} ${skill.name}`}
      />
      <Button size="sm" variant="ghost" icon={Edit3} data-testid="skill-edit" onClick={onEdit}>
        Edit
      </Button>
      <Button
        size="sm"
        variant="ghost"
        icon={isExpanded ? X : ChevronDown}
        data-testid="skill-view"
        aria-expanded={isExpanded}
        onClick={onView}
      >
        {isExpanded ? "Hide" : "View"}
      </Button>
      {isExpanded && (
        <pre className="mt-2 max-h-48 basis-full overflow-auto whitespace-pre-wrap rounded-ps-md bg-ps-surface-inset p-3 font-mono text-micro leading-relaxed text-ps-text-muted">
          {expandedContent ?? "// Loading..."}
        </pre>
      )}
    </LedgerRow>
  );
}
