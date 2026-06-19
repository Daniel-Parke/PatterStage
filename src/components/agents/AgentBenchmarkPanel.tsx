// ═══════════════════════════════════════════════════════════════
// AgentBenchmarkPanel — per-agent capability surface on the Agents page
//
// Shows an agent's Experience Level (how much it's been run) + its Agent
// Rating + the 6-stat JRPG radar (holistic across suites), pulled from the
// redacted agent-card endpoint. Empty state nudges the user to run a benchmark.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useEffect, useState } from "react";
import { Sparkles, Trophy } from "lucide-react";
import StatRadar from "@/components/viz/StatRadar";
import { apiFetch } from "@/lib/api-fetch";
import type { StatCard } from "@/lib/benchmarks/types";

interface Holistic {
  card: StatCard;
  rating: number;
  suites: number;
  bestStat?: { stat: string; value: number } | null;
}

interface AgentCard {
  agentRating: { rating: number; bestStat?: { stat: string } | null } | null;
  holistic: Holistic | null;
  experience: { level: number; title: string; xp: number } | null;
}

function ratingColor(r: number): string {
  if (r >= 80) return "var(--color-neon-green)";
  if (r >= 60) return "var(--color-neon-cyan)";
  if (r >= 40) return "var(--color-neon-yellow)";
  if (r >= 20) return "var(--color-neon-orange)";
  return "var(--color-neon-pink)";
}

export default function AgentBenchmarkPanel({ profileId }: { profileId: string }) {
  const [card, setCard] = useState<AgentCard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiFetch(`/api/benchmarks/agent-card?profile=${encodeURIComponent(profileId)}`)
      .then((d) => {
        if (active) setCard((d.data?.card as AgentCard) ?? null);
      })
      .catch(() => {
        if (active) setCard(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [profileId]);

  if (loading) {
    return <div className="font-mono text-[11px] text-white/30">Loading capability…</div>;
  }
  if (!card) return null;

  // Prefer the holistic rating (aggregated across all suites) — agentRating is
  // scoped to one suite and is often null when the run used a different suite.
  const rating = card.holistic?.rating ?? card.agentRating?.rating ?? null;
  const best = card.holistic?.bestStat?.stat ?? card.agentRating?.bestStat?.stat ?? null;

  return (
    <div className="rounded-xl border border-white/10 bg-dark-900/40 p-4">
      <div className="flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-neon-purple" />
          <div>
            <div className="text-[10px] uppercase tracking-wider text-white/30">Agent level</div>
            <div className="text-sm text-white/80">
              {card.experience ? (
                <>
                  Lv {card.experience.level} ·{" "}
                  <span className="text-white/50">{card.experience.title}</span>
                </>
              ) : (
                <span className="text-white/30">unranked</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-neon-yellow" />
          <div>
            <div className="text-[10px] uppercase tracking-wider text-white/30">Rating</div>
            <div
              className="font-mono text-lg font-bold leading-none"
              style={{ color: rating === null ? "rgba(255,255,255,0.3)" : ratingColor(rating) }}
            >
              {rating === null ? "—" : rating}
              {best ? <span className="ml-2 align-middle text-[10px] font-normal text-white/30">best: {best}</span> : null}
            </div>
          </div>
        </div>
      </div>

      {card.holistic ? (
        <div className="mt-3 flex items-center justify-center">
          <StatRadar card={card.holistic.card} />
        </div>
      ) : (
        <p className="mt-3 text-[11px] text-white/40">
          No benchmark yet —{" "}
          <a href="/benchmarks" className="text-neon-cyan hover:underline">
            run one →
          </a>{" "}
          to earn a stat card.
        </p>
      )}
    </div>
  );
}
