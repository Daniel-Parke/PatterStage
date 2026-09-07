// ═══════════════════════════════════════════════════════════════
// QuestRow — one quest, said plainly
//
// Presentational and pure: it is handed an evaluated quest and a yes/no about
// this host, and it renders. Availability is decided by the page (which is the
// only thing that knows the host) rather than read here, so the "unavailable"
// branch can be proved without a gateway, a memory provider or a platform.
//
// The rule the unavailable branch exists for: a quest this install cannot run
// still SHOWS. It loses its Go, because a link an operator cannot follow is
// worse than none, and it gains one sentence saying what is missing and what
// would change it. What it never does is claim to be complete, and it never
// leaves the count: a denominator that shrinks when the gateway goes down is a
// lie about how much of the programme is left.
//
// A row, not a card (U13, T-0127). The status word sits in a fixed-width
// column so every title starts at the same x; Go and Skip share one line; the
// achievement a quest earns is a chip, not a tile with a border of its own.
// ═══════════════════════════════════════════════════════════════

"use client";

import { ArrowRight, Medal } from "lucide-react";

import { ICONS } from "@/components/achievements/AchievementBadge";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import LinkButton from "@/components/ui/LinkButton";
import type { QuestState } from "@/lib/quests/evaluate";
import { CONCEPT_LABELS, HOST_REQUIREMENT_COPY } from "@/lib/quests/quest-defs";
import { ACHIEVEMENT_DEFS, achievementPoints, achievementTier, type Achievement } from "@/lib/stats/derive";
import { statusToneClasses } from "@/lib/theme";

export interface QuestRowProps {
  /** The evaluated state, off the stats poll. */
  quest: QuestState;
  /** `questAvailable(quest, host)`, computed by the page. */
  available: boolean;
  onSkip?: (id: string) => void;
  onUnskip?: (id: string) => void;
}

/**
 * The achievement a quest earns.
 *
 * The row is handed no achievement ledger, so the chip mirrors the QUEST: the
 * chain achievements are proved by the same event the quest is, so a complete
 * quest is an earned badge. The live ledger, with every other achievement in
 * it, is on the Insights page and stays the one place that counts them.
 */
function earned(id: string, unlocked: boolean): Achievement | null {
  const def = ACHIEVEMENT_DEFS.find((d) => d.id === id);
  if (!def) return null;
  return {
    id: def.id,
    name: def.name,
    description: def.description,
    icon: def.icon,
    color: def.color,
    unlocked,
    progress: unlocked ? 1 : 0,
    current: unlocked ? def.target : 0,
    target: def.target,
    tier: achievementTier(def.id),
    points: achievementPoints(def.id),
  };
}

/** The stamp as a person reads dates, or nothing when it will not parse. */
function onDay(iso: string | null): string | null {
  if (!iso) return null;
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? null : at.toLocaleDateString();
}

const LABEL = "font-mono text-micro uppercase tracking-wider text-ps-text-muted";

export default function QuestRow({ quest, available, onSkip, onUnskip }: QuestRowProps) {
  // Only a quest that asks something of the host can be refused by one. An
  // `available` of false with nothing required is not a state the page
  // produces, and inventing a reason for it would be inventing the reason.
  const blocked = !available && quest.requires ? HOST_REQUIREMENT_COPY[quest.requires] : null;
  const marker = quest.skipped ? "Skipped" : quest.completed ? "Complete" : "To do";
  const markerTone = quest.skipped
    ? "text-ps-text-faint"
    : quest.completed
      ? statusToneClasses.ok.text
      : "text-ps-text-muted";
  const day = quest.completed && !quest.skipped ? onDay(quest.completedAt) : null;
  const badge = quest.earns ? earned(quest.earns, quest.completed) : null;
  const BadgeIcon = badge ? (ICONS[badge.icon] ?? Medal) : null;

  return (
    <li className={`flex gap-4 px-5 py-4 ${quest.skipped ? "opacity-60" : ""}`}>
      {/* The fixed column. Titles used to start wherever the marker word
          ended, 23px further right for "Complete" than for "To do". */}
      <span className={`w-24 shrink-0 pt-0.5 font-mono text-micro uppercase tracking-wider ${markerTone}`}>{marker}</span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 className="text-body font-semibold text-ps-text-primary">{quest.title}</h3>
          {day && (
            <span className="font-mono text-micro text-ps-text-faint" title="The day this was first seen done">
              {day}
            </span>
          )}
        </div>

        <p className="mt-1 text-body text-ps-text-secondary">{quest.action}</p>

        {(quest.teaches.length > 0 || badge) && (
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {quest.teaches.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={LABEL}>Teaches</span>
                {quest.teaches.map((concept) => (
                  <Badge key={concept} color="gray">
                    {CONCEPT_LABELS[concept] ?? concept}
                  </Badge>
                ))}
              </div>
            )}
            {badge && BadgeIcon && (
              <div className="flex items-center gap-1.5">
                <span className={LABEL}>Earns</span>
                {/* A chip in Inter, not a Badge: an achievement's name is a
                    name, and decision 10 keeps mono for machine words. The
                    census counts every quest row, folded or not, and four
                    names in mono moved the register the wrong way. */}
                <span
                  title={badge.description}
                  className={`inline-flex items-center gap-1.5 rounded-ps-sm px-2 py-0.5 text-body ${
                    badge.unlocked ? "bg-neon-orange/10 text-neon-orange" : "bg-ps-surface-raised text-ps-text-muted"
                  }`}
                >
                  <BadgeIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  {badge.name}
                </span>
              </div>
            )}
          </div>
        )}

        {blocked && (
          <div className="mt-2">
            <p className={`font-mono text-micro uppercase tracking-wider ${statusToneClasses.blocked.text}`}>
              Unavailable on this host
            </p>
            <p className="mt-0.5 text-body text-ps-text-secondary">{blocked}</p>
          </div>
        )}

        {(!blocked || onSkip || onUnskip) && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {!blocked && (
              <LinkButton href={quest.screen} color="orange" size="sm" icon={ArrowRight}>
                Go
              </LinkButton>
            )}
            {quest.skipped
              ? onUnskip && (
                  <Button variant="ghost" size="sm" onClick={() => onUnskip(quest.id)}>
                    Unskip
                  </Button>
                )
              : onSkip && (
                  <Button variant="ghost" size="sm" onClick={() => onSkip(quest.id)}>
                    Skip
                  </Button>
                )}
          </div>
        )}
      </div>
    </li>
  );
}
