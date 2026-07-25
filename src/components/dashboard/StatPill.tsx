// ═══════════════════════════════════════════════════════════════
// StatPill — Compact metric display for dashboard stat row
// ═══════════════════════════════════════════════════════════════
// Uses shared theme color maps instead of inline duplication.
// Import this instead of redefining STAT_COLOR_CLASSES in each page.

import Link from "next/link";

import type { AccentColor } from "@/types/console";
import { iconColorMap } from "@/lib/theme";
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
  // Derive border colour from the text colour pattern: replace "text-" with "border-"
  const borderClass = textColor.replace(/^text-/, "border-") + "/20";
  const base = `rounded-lg border ${borderClass} bg-dark-900/50 px-4 py-3 flex items-center gap-3 min-w-0`;

  const inner = (
    <>
      <Icon className={`w-4 h-4 opacity-60 flex-shrink-0 ${textColor}`} />
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-mono text-white/40 uppercase truncate">
          {label}
        </div>
        <div className={`text-lg font-bold font-mono truncate ${textColor}`}>
          {value}
        </div>
        {subtitle && (
          <div className="text-[10px] font-mono text-white/30 truncate">
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
    const hoverBorder = textColor.replace(/^text-/, "hover:border-") + "/45";
    return (
      <Link href={href} className={`${base} ${hoverBorder} hover:bg-dark-900/70 transition-colors`}>
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
    <div className="rounded-lg border border-white/10 bg-dark-900/30 px-4 py-3 flex items-center gap-3 animate-pulse">
      <div className="w-4 h-4 rounded bg-white/10 flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-16 rounded bg-white/10" />
        <div className="h-5 w-24 rounded bg-white/10" />
      </div>
    </div>
  );
}