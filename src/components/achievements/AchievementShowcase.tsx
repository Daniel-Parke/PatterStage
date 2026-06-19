"use client";

// ═══════════════════════════════════════════════════════════════
// AchievementShowcase — compact "trophy case". Shows the rarest unlocked
// + nearest-to-unlock by default with a points summary, and expands
// (Motion) to the full filterable grid. Replaces the always-on 37-tile
// grid on both the dashboard and Insights.
// ═══════════════════════════════════════════════════════════════

import { useMemo, useState } from "react";
import { Trophy, ChevronDown, Target } from "lucide-react";
import type { Achievement } from "@/lib/stats/derive";
import { neon, neonAlpha, type NeonColor } from "@/components/viz/colors";
import AchievementBadge, { ICONS } from "@/components/achievements/AchievementBadge";
import {
  summarizeAchievements,
  selectShowcase,
  byRarity,
  TIER_LABEL,
  TIER_COLOR,
} from "@/lib/achievements-showcase";
import type { AchievementTier } from "@/lib/stats/derive";
import { Collapse, Stagger, StaggerItem } from "@/components/motion";

type Filter = "all" | "unlocked" | "locked";

const TIER_ORDER: AchievementTier[] = ["legendary", "epic", "rare", "common"];

function TrophyChip({ a }: { a: Achievement }) {
  const Icon = ICONS[a.icon] ?? Trophy;
  const tc = TIER_COLOR[a.tier] as NeonColor;
  return (
    <div
      className="flex min-w-0 items-center gap-2 rounded-lg border px-2.5 py-1.5"
      style={{ borderColor: neonAlpha(tc, 30), background: neonAlpha(tc, 8) }}
      title={`${a.name} — ${a.description} · ${TIER_LABEL[a.tier]} · ${a.points} pts`}
    >
      <div
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full"
        style={{ background: neonAlpha(tc, 18), boxShadow: `0 0 12px ${neonAlpha(tc, 18)}` }}
      >
        <Icon className="h-3.5 w-3.5" style={{ color: neon(tc) }} />
      </div>
      <div className="min-w-0">
        <div className="truncate text-xs font-medium text-white/85">{a.name}</div>
        <div className="text-[9px] font-mono uppercase tracking-wider" style={{ color: neon(tc) }}>
          {TIER_LABEL[a.tier]} · {a.points}pts
        </div>
      </div>
    </div>
  );
}

export default function AchievementShowcase({
  achievements,
  className = "",
}: {
  achievements: Achievement[];
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");

  const summary = useMemo(() => summarizeAchievements(achievements), [achievements]);
  const { featured, nearest } = useMemo(() => selectShowcase(achievements), [achievements]);

  const filtered = useMemo(() => {
    const list = achievements.filter((a) =>
      filter === "all" ? true : filter === "unlocked" ? a.unlocked : !a.unlocked,
    );
    return [...list].sort(byRarity);
  }, [achievements, filter]);

  const pct = summary.total > 0 ? Math.round((summary.unlocked / summary.total) * 100) : 0;

  return (
    <div
      className={`rounded-2xl border border-white/10 bg-dark-900/40 p-4 ${className}`}
    >
      {/* Header */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-neon-yellow" />
          <span className="text-xs font-mono uppercase tracking-widest text-white/50">
            Achievements
          </span>
          <span className="rounded-full border border-neon-yellow/30 bg-neon-yellow/10 px-2 py-0.5 text-[10px] font-mono text-neon-yellow">
            {summary.points} / {summary.totalPoints} pts
          </span>
        </div>
        <div className="flex items-center gap-3">
          {/* Per-tier breakdown chips */}
          <div className="hidden items-center gap-1.5 sm:flex">
            {TIER_ORDER.map((t) => {
              const tc = TIER_COLOR[t] as NeonColor;
              const b = summary.byTier[t];
              if (b.total === 0) return null;
              return (
                <span
                  key={t}
                  className="rounded px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider"
                  style={{ color: neon(tc), background: neonAlpha(tc, 10) }}
                  title={`${TIER_LABEL[t]}: ${b.unlocked}/${b.total}`}
                >
                  {t[0]}
                  {b.unlocked}/{b.total}
                </span>
              );
            })}
          </div>
          <span className="font-mono text-xs text-white/50">
            {summary.unlocked}/{summary.total} · {pct}%
          </span>
        </div>
      </div>

      {/* Compact featured view (hidden when expanded) */}
      {!expanded && (
        <div className="space-y-3">
          {featured.length > 0 ? (
            <div>
              <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-white/30">
                <Trophy className="h-3 w-3" /> Rarest earned
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                {featured.map((a) => (
                  <TrophyChip key={a.id} a={a} />
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-white/40">
              No achievements unlocked yet — dispatch a mission or weave a story to begin.
            </p>
          )}

          {nearest.length > 0 && (
            <div>
              <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-white/30">
                <Target className="h-3 w-3" /> Closest to unlock
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {nearest.map((a) => (
                  <AchievementBadge key={a.id} achievement={a} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Expanded full grid */}
      <Collapse open={expanded}>
        <div className="pt-1">
          {/* Filters */}
          <div className="mb-3 flex items-center gap-1.5">
            {(["all", "unlocked", "locked"] as Filter[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-mono capitalize transition-colors ${
                  filter === f
                    ? "bg-neon-purple/20 text-neon-purple"
                    : "text-white/40 hover:text-white/70"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <Stagger className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-9">
            {filtered.map((a) => (
              <StaggerItem key={a.id}>
                <AchievementBadge achievement={a} />
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </Collapse>

      {/* Expand / collapse toggle */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/5 py-1.5 text-[11px] font-mono text-white/40 transition-colors hover:border-white/15 hover:text-white/70"
      >
        {expanded ? "Show less" : `Show all ${summary.total}`}
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>
    </div>
  );
}
