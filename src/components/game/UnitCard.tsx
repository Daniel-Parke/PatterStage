"use client";

import { Heart, Swords, Shield, Wind, Brain, Wrench, Star } from "lucide-react";
import type { UnitCard as UnitCardType, UnitStats } from "@/lib/game/types";
import { RARITY_COLOR } from "@/lib/game/types";
import { neon, neonAlpha, type NeonColor } from "@/components/viz/colors";

const STAT_META: { key: keyof UnitStats; label: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; color: NeonColor }[] = [
  { key: "hp", label: "HP", icon: Heart, color: "green" },
  { key: "atk", label: "ATK", icon: Swords, color: "pink" },
  { key: "def", label: "DEF", icon: Shield, color: "cyan" },
  { key: "spd", label: "SPD", icon: Wind, color: "orange" },
  { key: "int", label: "INT", icon: Brain, color: "purple" },
  { key: "tec", label: "TEC", icon: Wrench, color: "yellow" },
];

const RARITY_STARS: Record<UnitCardType["rarity"], number> = { common: 1, rare: 2, epic: 3, legendary: 4, mythic: 5 };

export default function UnitCard({ card, onClick }: { card: UnitCardType; onClick?: () => void }) {
  const rc = RARITY_COLOR[card.rarity] as NeonColor;
  const stars = RARITY_STARS[card.rarity];

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative w-full overflow-hidden rounded-2xl border p-4 text-left transition-transform duration-200 hover:-translate-y-1"
      style={{ borderColor: neonAlpha(rc, 45), background: `linear-gradient(160deg, ${neonAlpha(rc, 12)}, rgba(8,12,20,0.85))`, boxShadow: `0 0 26px ${neonAlpha(rc, 18)}` }}
    >
      {/* rarity ribbon */}
      <div className="pointer-events-none absolute right-0 top-0 h-20 w-20 overflow-hidden">
        <div className="absolute -right-8 top-3 rotate-45 px-8 py-0.5 text-center text-[9px] font-bold uppercase tracking-wider text-black" style={{ background: neon(rc) }}>
          {card.rarity}
        </div>
      </div>

      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl font-mono text-lg font-bold" style={{ background: neonAlpha(rc, 18), color: neon(rc), boxShadow: `inset 0 0 16px ${neonAlpha(rc, 25)}` }}>
          {card.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-white">{card.name}</div>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="font-mono uppercase tracking-wide" style={{ color: neon(card.element as NeonColor) }}>{card.className}</span>
            <span className="text-white/30">·</span>
            <span className="text-white/50">Lv {card.level}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className="h-2.5 w-2.5" style={{ color: i < stars ? neon(rc) : "rgba(255,255,255,0.15)", fill: i < stars ? neon(rc) : "transparent" }} />
            ))}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[9px] uppercase tracking-wider text-white/40">Power</div>
          <div className="font-mono text-xl font-bold" style={{ color: neon(rc) }}>{card.power}</div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
        {STAT_META.map((s) => {
          const v = card.stats[s.key];
          return (
            <div key={s.key} className="flex items-center gap-1.5">
              <s.icon className="h-3 w-3 shrink-0" style={{ color: neon(s.color) }} />
              <span className="w-7 text-[10px] font-mono text-white/40">{s.label}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
                <div className="h-full rounded-full" style={{ width: `${(v / 99) * 100}%`, background: neon(s.color) }} />
              </div>
              <span className="w-5 text-right font-mono text-[10px] text-white/70">{v}</span>
            </div>
          );
        })}
      </div>

      {card.abilities.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {card.abilities.map((ab) => (
            <span key={ab} className="rounded-md px-1.5 py-0.5 text-[10px] font-mono" style={{ background: neonAlpha(rc, 10), color: neonAlpha(rc, 90) }}>{ab}</span>
          ))}
        </div>
      )}
    </button>
  );
}
