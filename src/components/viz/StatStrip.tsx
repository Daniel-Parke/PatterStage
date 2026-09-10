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
import Card from "@/components/ui/Card";

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
    // A stat tile is a CLAIM about the list beneath it, and that claim has
    // been wrong twice (T-0037 on skills, T-0042 on sessions) and painted as
    // a literal 0 on first frame once (T-0035). The test id and the label let
    // a test read the rendered number rather than the props behind it, which
    // is the only reading that catches all three.
    <Card variant="raised" padding="none" data-testid="stat-tile">
      <div
        className="rounded-ps-lg px-3 py-2"
        style={{ boxShadow: `inset 0 0 16px ${neonAlpha(color, 5)}` }}
        title={hint}
        data-stat-label={label}
      >
        <div className="flex items-center gap-1.5">
          <Icon className="h-3 w-3" style={{ color: neon(color) }} />
          <span className="text-micro uppercase tracking-wider text-ps-text-muted">{label}</span>
        </div>
        <div className="mt-0.5 font-mono text-title font-bold leading-none text-ps-text-primary">
          {compact ? compactNum(n) : Math.round(n).toLocaleString()}
          {suffix && <span className="ml-0.5 text-body font-normal text-ps-text-muted">{suffix}</span>}
        </div>
      </div>
    </Card>
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
  /**
   * `hint` is the same affordance the tiles carry: a ring shows a rate, and a
   * rate is a division whose denominator the reader cannot see. Optional, so
   * every existing caller is unchanged.
   */
  ring?: { value: number; color: NeonColor; label: ReactNode; sublabel?: ReactNode; hint?: string };
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
    <Card className={`animate-float-in grid grid-cols-1 items-center gap-5 ${layout} ${className}`}>
      {/* A phone gets one row of the numbers and none of the pictures: on
          /results/sessions at 390 the donut, the tile and the ring stacked to
          350px before the search field (the review of 2026-09-08, T-0133).
          Derived from the same props, so every strip has it and no caller
          changed. The count-up is the tiles'; a row is read, not watched. */}
      <div
        data-testid="strip-phone-row"
        className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono text-body text-ps-text-secondary sm:hidden"
      >
        {donut && (
          <span>
            <span className="font-bold text-ps-text-primary">{donut.center}</span>
            {donut.centerSub && <> {donut.centerSub}</>}
          </span>
        )}
        {tiles.map((t) => (
          <span key={t.label}>
            <span className="font-bold text-ps-text-primary">
              {t.compact ? compactNum(t.value) : Math.round(t.value).toLocaleString()}
              {t.suffix ?? ""}
            </span>{" "}
            {t.label.toLowerCase()}
          </span>
        ))}
        {ring && (
          <span>
            <span className="font-bold text-ps-text-primary">{ring.label}</span>
            {ring.sublabel && <> {ring.sublabel}</>}
          </span>
        )}
      </div>
      {/* The donut, and its LEGEND. `Donut` uses `segment.label` as a React key
          and renders nothing from it, so for as long as this strip drew a bare
          ring of arcs, the only place a segment's name and number appeared was
          a tile beside it that repeated them. That is why every strip in the
          product carried tiles saying Errors / Warnings / Info next to a donut
          made of errors, warnings and info.
          A legend is the smaller half of that pair and the honest one: the
          picture says the MIX, the legend says the numbers, and a tile is then
          free to be what a tile should be - a fact neither of them carries
          (T-0124). */}
      {donut && (
        <div className="hidden items-center justify-center gap-4 sm:flex">
          <Donut size={96} thickness={12} segments={donut.segments} center={donut.center} centerSub={donut.centerSub} />
          {donut.segments.length > 0 && (
            <ul data-testid="donut-legend" className="min-w-0 space-y-1">
              {donut.segments.map((seg) => (
                <li key={seg.label} className="flex items-center gap-2 whitespace-nowrap text-micro">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: neon(seg.color) }}
                  />
                  <span className="text-ps-text-secondary">{seg.label}</span>
                  <span className="ml-auto font-mono tabular-nums text-ps-text-muted">
                    {seg.value.toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {tiles.length > 0 && (
        <div className={`hidden gap-2 sm:grid ${tiles.length >= 4 ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
          {tiles.map((t) => (
            <Tile key={t.label} {...t} />
          ))}
        </div>
      )}
      {ring && (
        <div data-testid="stat-ring" className="hidden justify-center sm:flex" title={ring.hint}>
          <ProgressRing value={ring.value} color={ring.color} size={84} thickness={8} label={ring.label} sublabel={ring.sublabel} />
        </div>
      )}
    </Card>
  );
}
