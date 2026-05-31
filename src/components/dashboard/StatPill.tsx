// ═══════════════════════════════════════════════════════════════
// StatPill — Compact metric display for dashboard stat row
// ═══════════════════════════════════════════════════════════════
// Uses shared theme color maps instead of inline duplication.
// Import this instead of redefining STAT_COLOR_CLASSES in each page.

import type { AccentColor } from "@/types/hermes";
import { iconColorMap } from "@/lib/theme";

/**
 * Stat pill for compact metric display — uses theme.ts colors as the single
 * source of truth for border + text styling, so there's only one place to
 * update when accent colours change.
 */
export function StatPill({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  color: AccentColor;
}) {
  const textColor = iconColorMap[color];
  // Derive border colour from the text colour pattern: replace "text-" with "border-"
  const borderClass = textColor.replace(/^text-/, "border-") + "/20";

  return (
    <div
      className={`rounded-lg border ${borderClass} bg-dark-900/50 px-4 py-3 flex items-center gap-3 min-w-0`}
    >
      <Icon className={`w-4 h-4 opacity-60 flex-shrink-0 ${textColor}`} />
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-mono text-white/40 uppercase truncate">
          {label}
        </div>
        <div className={`text-lg font-bold font-mono truncate ${textColor}`}>
          {value}
        </div>
      </div>
    </div>
  );
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