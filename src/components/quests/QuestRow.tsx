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
// ═══════════════════════════════════════════════════════════════

"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import AchievementBadge from "@/components/achievements/AchievementBadge";
import Badge from "@/components/ui/Badge";
import type { QuestState } from "@/lib/quests/evaluate";
import { CONCEPT_LABELS, HOST_REQUIREMENT_COPY } from "@/lib/quests/quest-defs";
import { ACHIEVEMENT_DEFS, achievementPoints, achievementTier, type Achievement } from "@/lib/stats/derive";

export interface QuestRowProps {
  /** The evaluated state, off the stats poll. */
  quest: QuestState;
  /** `questAvailable(quest, host)`, computed by the page. */
  available: boolean;
  onSkip?: (id: string) => void;
  onUnskip?: (id: string) => void;
}

/**
 * The achievement a quest earns, dressed as the shell's own badge.
 *
 * The row is handed no achievement ledger, so the badge mirrors the QUEST: the
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

export default function QuestRow({ quest, available, onSkip, onUnskip }: QuestRowProps) {
  // Only a quest that asks something of the host can be refused by one. An
  // `available` of false with nothing required is not a state the page
  // produces, and inventing a reason for it would be inventing the reason.
  const blocked = !available && quest.requires ? HOST_REQUIREMENT_COPY[quest.requires] : null;
  const marker = quest.skipped ? "Skipped" : quest.completed ? "Complete" : "To do";
  const markerTone = quest.skipped
    ? "text-ps-text-faint"
    : quest.completed
      ? "text-neon-green"
      : "text-ps-text-muted";
  const day = quest.completed && !quest.skipped ? onDay(quest.completedAt) : null;
  const badge = quest.earns ? earned(quest.earns, quest.completed) : null;

  return (
    <li
      className={`rounded-xl border border-white/10 bg-dark-900/40 p-4 ${quest.skipped ? "opacity-60" : ""}`}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className={`font-mono text-xs uppercase tracking-wider ${markerTone}`}>{marker}</span>
        <h3 className="text-sm font-semibold text-ps-text-primary">{quest.title}</h3>
        {day && (
          <span className="font-mono text-xs text-ps-text-faint" title="The day this was first seen done">
            {day}
          </span>
        )}
      </div>

      <p className="mt-1 text-sm text-ps-text-secondary">{quest.action}</p>

      {quest.teaches.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-xs uppercase tracking-wider text-ps-text-muted">Teaches</span>
          {quest.teaches.map((concept) => (
            <Badge key={concept} color="gray">
              {CONCEPT_LABELS[concept] ?? concept}
            </Badge>
          ))}
        </div>
      )}

      {badge && (
        <div className="mt-2 flex items-center gap-2">
          <span className="font-mono text-xs uppercase tracking-wider text-ps-text-muted">Earns</span>
          <div className="w-28">
            <AchievementBadge achievement={badge} />
          </div>
        </div>
      )}

      {blocked ? (
        <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-3">
          <p className="font-mono text-xs uppercase tracking-wider text-ps-text-muted">
            Unavailable on this host
          </p>
          <p className="mt-1 text-xs text-ps-text-secondary">{blocked}</p>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Link
            href={quest.screen}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neon-orange/30 px-2.5 py-1 font-mono text-xs text-neon-orange transition-colors hover:bg-neon-orange/10"
          >
            Go
            <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </Link>
        </div>
      )}

      {(onSkip || onUnskip) && (
        <div className="mt-2">
          {quest.skipped
            ? onUnskip && (
                <button
                  type="button"
                  onClick={() => onUnskip(quest.id)}
                  className="rounded-lg border border-white/10 px-2.5 py-1 font-mono text-xs text-ps-text-muted transition-colors hover:bg-white/5 hover:text-ps-text-primary"
                >
                  Unskip
                </button>
              )
            : onSkip && (
                <button
                  type="button"
                  onClick={() => onSkip(quest.id)}
                  className="rounded-lg border border-white/10 px-2.5 py-1 font-mono text-xs text-ps-text-muted transition-colors hover:bg-white/5 hover:text-ps-text-primary"
                >
                  Skip
                </button>
              )}
        </div>
      )}
    </li>
  );
}
