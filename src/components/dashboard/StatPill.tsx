// ═══════════════════════════════════════════════════════════════
// StatPill — Compact metric display for dashboard stat row
// ═══════════════════════════════════════════════════════════════
// Uses shared theme color maps instead of inline duplication.
// Import this instead of redefining STAT_COLOR_CLASSES in each page.

import Link from "next/link";

import type { AccentColor } from "@/types/console";
import { iconColorMap, pillBorderHoverMap, pillBorderMap } from "@/lib/theme";
import Sparkline from "@/components/viz/Sparkline";
import type { NeonColor } from "@/components/viz/colors";

/**
 * Stat pill for compact metric display — uses theme.ts colors as the single
 * source of truth for border + text styling, so there's only one place to
 * update when accent colours change.
 *
 * When `href` is provided the pill becomes a hover-aware link (the dashboard
 * pills drill into Agents / Sessions / Memory), otherwise it renders as a
 * static card.
 */
export function StatPill({
  icon: Icon,
  label,
  value,
  color,
  subtitle,
  href,
  trend,
  trendColor = "cyan",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  color: AccentColor;
  /** Optional secondary line below the value (e.g. "12 last 7d"). */
  subtitle?: string;
  /** When set, the pill is a link to this path (with a hover affordance). */
  href?: string;
  /** Optional trailing trend series — renders a compact sparkline on the right. */
  trend?: number[];
  /** Sparkline accent (defaults to cyan). */
  trendColor?: NeonColor;
}) {
  const textColor = iconColorMap[color];
  // From a map, not from the text colour. Deriving it with
  // `.replace(/^text-/, "border-")` produced a class Tailwind never sees, so
  // three accents drew a solid white ring and all eight hovers were dead
  // (T-0120).
  const borderClass = pillBorderMap[color];
  // items-start, not items-center: a pill with a subtitle and one without sat
  // on different baselines in the same row (T-0127).
  const base = `rounded-ps-md border ${borderClass} bg-ps-surface-panel px-4 py-3 flex items-start gap-3 min-w-0`;

  const inner = (
    <>
      <Icon className={`mt-0.5 w-4 h-4 opacity-60 flex-shrink-0 ${textColor}`} />
      <div className="min-w-0 flex-1">
        <div className="text-micro font-mono text-ps-text-muted uppercase truncate">
          {label}
        </div>
        <div className={`text-title font-bold font-mono truncate ${textColor}`}>
          {value}
        </div>
        {subtitle && (
          <div className="text-micro font-mono text-ps-text-muted truncate">
            {subtitle}
          </div>
        )}
      </div>
      {trend && trend.length > 1 && (
        <Sparkline
          data={trend}
          color={trendColor}
          width={52}
          height={28}
          strokeWidth={1.5}
          className="flex-shrink-0 self-center opacity-70"
        />
      )}
    </>
  );

  if (href) {
    const hoverBorder = pillBorderHoverMap[color];
    return (
      <Link href={href} className={`${base} ${hoverBorder} hover:bg-ps-surface-panel transition-colors`}>
        {inner}
      </Link>
    );
  }

  return <div className={base}>{inner}</div>;
}

/**
 * Skeleton placeholder for StatPill — used during initial load.
 */
export function StatPillSkeleton() {
  return (
    <div className="rounded-ps-md border border-ps-edge-hairline bg-ps-surface-panel px-4 py-3 flex items-center gap-3 animate-pulse">
      <div className="w-4 h-4 rounded-ps-sm bg-ps-surface-raised flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-16 rounded-ps-sm bg-ps-surface-raised" />
        <div className="h-5 w-24 rounded-ps-sm bg-ps-surface-raised" />
      </div>
    </div>
  );
}