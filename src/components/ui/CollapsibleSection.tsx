// ═══════════════════════════════════════════════════════════════
// CollapsibleSection — reusable togglable section with header badge
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { ReactNode } from "react";

export interface CollapsibleSectionProps {
  /** Section title shown in the header bar. */
  title: string;
  /** Optional badge count (e.g. number of entries). */
  badge?: number | string;
  /** Description text shown only when expanded. */
  description?: string;
  /** Whether the section starts expanded (default: false). */
  defaultExpanded?: boolean;
  /** Children rendered inside the expandable body. */
  children: ReactNode;
  /** Optional extra actions rendered on the right side of the header. */
  headerRight?: ReactNode;
  /** Accent colour for the badge pill (default: "purple"). */
  badgeColor?: "purple" | "orange" | "green" | "cyan";
}

const badgeColorMap: Record<string, string> = {
  purple: "bg-neon-purple/15 text-neon-purple",
  orange: "bg-neon-orange/15 text-neon-orange",
  green: "bg-neon-green/15 text-neon-green",
  cyan: "bg-neon-cyan/15 text-neon-cyan",
};

export default function CollapsibleSection({
  title,
  badge,
  description,
  defaultExpanded = false,
  children,
  headerRight,
  badgeColor = "purple",
}: CollapsibleSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="rounded-xl border border-white/10 bg-dark-900/40 overflow-hidden">
      {/* Header — always visible */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-bold text-white/70 uppercase tracking-wider">
            {title}
          </h2>
          {badge !== undefined && (
            <span
              className={`text-[10px] font-mono px-1.5 py-0.5 rounded uppercase tracking-widest ${badgeColorMap[badgeColor]}`}
            >
              {badge}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {headerRight}
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-white/30" />
          ) : (
            <ChevronDown className="w-4 h-4 text-white/30" />
          )}
        </div>
      </button>

      {/* Body — conditionally rendered */}
      {expanded && (
        <div className="px-5 pb-5 pt-1 border-t border-white/5 space-y-4">
          {description && (
            <p className="text-xs text-white/30 mt-0.5">{description}</p>
          )}
          {children}
        </div>
      )}
    </div>
  );
}
