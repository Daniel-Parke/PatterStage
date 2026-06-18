"use client";

// ═══════════════════════════════════════════════════════════════
// AgentRatingBadge — the Agent Rating pillar
//
// A SECOND progression axis, shown alongside LevelBadge/StreakFlame. Operator
// XP (LevelBadge) = how much you operate; Agent Rating (this) = how good your
// agent is, from its latest benchmark run. Deliberately the same visual
// vocabulary (ProgressRing) so the two axes read as siblings.
// ═══════════════════════════════════════════════════════════════

import ProgressRing from "@/components/viz/ProgressRing";
import { type NeonColor } from "@/components/viz/colors";
import { DOMAIN_LABELS } from "@/lib/benchmarks/types";
import type { AgentRating } from "@/lib/benchmarks/rating";

function ratingNeon(rating: number): NeonColor {
  if (rating >= 80) return "green";
  if (rating >= 60) return "cyan";
  if (rating >= 40) return "yellow";
  return "orange";
}

export default function AgentRatingBadge({
  rating,
  label,
}: {
  rating: AgentRating | null;
  label?: string;
}) {
  const color: NeonColor = rating ? ratingNeon(rating.rating) : "cyan";
  return (
    <div className="flex items-center gap-3">
      <ProgressRing
        value={rating ? rating.rating / 100 : 0}
        color={color}
        size={64}
        thickness={6}
        label={<span className="text-lg font-bold">{rating ? rating.rating : "—"}</span>}
        sublabel="RATING"
      />
      <div className="min-w-0">
        <div className="truncate font-mono text-sm font-semibold text-white">
          {label ?? (rating ? rating.suiteKey : "Agent Rating")}
        </div>
        {rating ? (
          <>
            <div className="text-[11px] text-white/40">
              best: {rating.bestDomain ? DOMAIN_LABELS[rating.bestDomain.domain] : "—"}
            </div>
            <div className="text-[11px] text-white/40">
              {rating.repeats}× · {rating.domains.length} domains
            </div>
          </>
        ) : (
          <div className="text-[11px] text-white/40">Run a benchmark to rate this agent</div>
        )}
      </div>
    </div>
  );
}
