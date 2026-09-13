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
        style={{ background: hot ? neonAlpha(color, 18) : "var(--color-ps-viz-empty)" }}
      >
        <Flame
          className={`h-5 w-5 ${hot ? "animate-flame" : "text-ps-text-faint"}`}
          style={hot ? { color: neon(color), filter: `drop-shadow(0 0 6px ${neonAlpha(color, 60)})` } : undefined}
        />
      </div>
      <div>
        <div className="font-mono text-title font-bold leading-none text-ps-text-primary">
          {current}
          <span className="ml-1 text-body font-normal text-ps-text-muted">day{current === 1 ? "" : "s"}</span>
        </div>
        <div className="text-body text-ps-text-muted">best {longest}</div>
      </div>
    </div>
  );
}
