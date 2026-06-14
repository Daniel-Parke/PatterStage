"use client";

import { Sparkles } from "lucide-react";
import type { PullResult } from "@/lib/game/types";
import { RARITY_COLOR } from "@/lib/game/types";
import { neon, neonAlpha, type NeonColor } from "@/components/viz/colors";

export default function GachaReveal({
  result,
  onClose,
  onAgain,
  canAgain,
}: {
  result: PullResult;
  onClose: () => void;
  onAgain?: () => void;
  canAgain?: boolean;
}) {
  const rc = RARITY_COLOR[result.rarity] as NeonColor;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="animate-float-in relative w-full max-w-sm rounded-2xl border p-8 text-center"
        style={{ borderColor: neonAlpha(rc, 50), background: `radial-gradient(circle at 50% 0%, ${neonAlpha(rc, 18)}, rgba(8,12,20,0.96))`, boxShadow: `0 0 60px ${neonAlpha(rc, 30)}` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-xs font-mono uppercase tracking-[0.3em]" style={{ color: neon(rc) }}>
          {result.rarity}
          {result.pityTriggered && " · pity"}
        </div>
        <div className="mx-auto my-6 flex h-28 w-28 items-center justify-center rounded-2xl" style={{ background: neonAlpha(rc, 15), boxShadow: `0 0 40px ${neonAlpha(rc, 40)}` }}>
          <Sparkles className="h-12 w-12 animate-pulse-glow" style={{ color: neon(rc) }} />
        </div>
        <div className="text-lg font-bold text-white">{result.item.name}</div>
        <div className="mt-1 text-xs text-white/50">{result.item.description}</div>
        {result.duplicate && (
          <div className="mt-2 font-mono text-xs" style={{ color: neon("yellow") }}>
            Duplicate → +{result.shards} Shards
          </div>
        )}
        <div className="mt-6 flex gap-2">
          {onAgain && (
            <button
              type="button"
              onClick={onAgain}
              disabled={!canAgain}
              className="flex-1 rounded-lg border px-4 py-2 text-sm font-mono transition-colors disabled:opacity-40"
              style={{ borderColor: neonAlpha(rc, 40), color: neon(rc) }}
            >
              Again · 100
            </button>
          )}
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-white/10 px-4 py-2 text-sm font-mono text-white/60 hover:bg-white/5">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
