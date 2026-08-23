"use client";

import { Flame } from "lucide-react";
import { neon, neonAlpha, type NeonColor } from "@/components/viz/colors";

export default function StreakFlame({ current, longest }: { current: number; longest: number }) {
  const hot = current > 0;
  const color: NeonColor = current >= 7 ? "orange" : current >= 3 ? "yellow" : "cyan";

  return (
    <div className="flex items-center gap-2.5" title={`Current streak: ${current} day(s) · Best: ${longest}`}>
      <div
        className="relative flex h-11 w-11 items-center justify-center rounded-full"
        style={{ background: hot ? neonAlpha(color, 18) : "rgba(255,255,255,0.04)" }}
      >
        <Flame
          className={`h-5 w-5 ${hot ? "animate-flame" : "text-ps-text-faint"}`}
          style={hot ? { color: neon(color), filter: `drop-shadow(0 0 6px ${neonAlpha(color, 60)})` } : undefined}
        />
      </div>
      <div>
        <div className="font-mono text-lg font-bold leading-none text-white">
          {current}
          <span className="ml-1 text-xs font-normal text-ps-text-muted">day{current === 1 ? "" : "s"}</span>
        </div>
        <div className="text-xs text-ps-text-muted">best {longest}</div>
      </div>
    </div>
  );
}
