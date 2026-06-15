"use client";

import ProgressRing from "@/components/viz/ProgressRing";
import { neon, type NeonColor } from "@/components/viz/colors";
import type { LevelInfo } from "@/lib/stats/derive";

export default function LevelBadge({ level, color = "cyan" }: { level: LevelInfo; color?: NeonColor }) {
  return (
    <div className="flex items-center gap-3">
      <ProgressRing
        value={level.progress}
        color={color}
        size={64}
        thickness={6}
        label={<span className="text-lg font-bold">{level.level}</span>}
        sublabel="LVL"
      />
      <div className="min-w-0">
        <div className="truncate font-mono text-sm font-semibold text-white">{level.title}</div>
        <div className="text-[11px] text-white/40">
          {level.xpIntoLevel.toLocaleString()} / {level.xpForLevel.toLocaleString()} XP
        </div>
        <div className="mt-1.5 h-1.5 w-32 overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full rounded-full transition-[width] duration-700"
            style={{ width: `${Math.round(level.progress * 100)}%`, background: neon(color) }}
          />
        </div>
      </div>
    </div>
  );
}
