"use client";

// Reusable insights strip: an optional status donut, a row of animated count-up
// tiles, and an optional progress ring. Pages compute their own slice and drop
// this in (see MissionInsights, SessionInsights, LogInsights). Layout collapses
// gracefully when the donut or ring is omitted.

import type { ReactNode } from "react";
import Donut, { type DonutSegment } from "./Donut";
import ProgressRing from "./ProgressRing";
import { neon, neonAlpha, type NeonColor } from "./colors";
import { useCountUp } from "@/hooks/useCountUp";

export interface StatTileSpec {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  value: number;
  color: NeonColor;
  suffix?: string;
  /** Format large values as 1.2k / 3.4M. */
  compact?: boolean;
  /** Optional hover tooltip clarifying exactly what the number counts. */
  hint?: string;
}

function compactNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return String(Math.round(n));
}

function Tile({ icon: Icon, label, value, color, suffix, compact, hint }: StatTileSpec) {
  const n = useCountUp(value);
  return (
    <div
      className="rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2"
      style={{ boxShadow: `inset 0 0 16px ${neonAlpha(color, 5)}` }}
      title={hint}
    >
      <div className="flex items-center gap-1.5">
        <Icon className="h-3 w-3" style={{ color: neon(color) }} />
        <span className="text-[10px] uppercase tracking-wider text-white/40">{label}</span>
      </div>
      <div className="mt-0.5 font-mono text-xl font-bold leading-none text-white">
        {compact ? compactNum(n) : Math.round(n).toLocaleString()}
        {suffix && <span className="ml-0.5 text-xs font-normal text-white/40">{suffix}</span>}
      </div>
    </div>
  );
}

export default function StatStrip({
  donut,
  tiles,
  ring,
  className = "",
}: {
  donut?: { segments: DonutSegment[]; center: ReactNode; centerSub?: ReactNode };
  tiles: StatTileSpec[];
  ring?: { value: number; color: NeonColor; label: ReactNode; sublabel?: ReactNode };
  className?: string;
}) {
  // Literal class strings so Tailwind's JIT can compile the arbitrary columns.
  const layout =
    donut && ring
      ? "sm:grid-cols-[auto_1fr_auto]"
      : donut
        ? "sm:grid-cols-[auto_1fr]"
        : ring
          ? "sm:grid-cols-[1fr_auto]"
          : "";
  return (
    <div
      className={`animate-float-in grid grid-cols-1 items-center gap-5 rounded-2xl border border-white/10 bg-dark-900/40 p-4 ${layout} ${className}`}
    >
      {donut && (
        <div className="flex justify-center">
          <Donut size={96} thickness={12} segments={donut.segments} center={donut.center} centerSub={donut.centerSub} />
        </div>
      )}
      <div className={`grid gap-2 ${tiles.length >= 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2 sm:grid-cols-3"}`}>
        {tiles.map((t) => (
          <Tile key={t.label} {...t} />
        ))}
      </div>
      {ring && (
        <div className="flex justify-center">
          <ProgressRing value={ring.value} color={ring.color} size={84} thickness={8} label={ring.label} sublabel={ring.sublabel} />
        </div>
      )}
    </div>
  );
}
