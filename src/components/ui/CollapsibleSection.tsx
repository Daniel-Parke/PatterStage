// ═══════════════════════════════════════════════════════════════
// CollapsibleSection — the disclosure
//
// A heading, a count, and a body that opens on demand. Uncontrolled by
// default (it holds its own open state); a caller that needs to open it from
// elsewhere, as Missions' empty state opens the templates, passes `expanded`
// and `onExpandedChange` (T-0133).
//
// `headerRight` renders BESIDE the disclosure button, not inside it: a
// control inside a button is nested interactive content, which the browser
// hoists out of the markup and a screen reader cannot reach (T-0071 found the
// same shape in the chat list).
// ═══════════════════════════════════════════════════════════════

"use client";

import { sectionHeadingClasses } from "@/lib/ui/theme";
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
  /** Whether the section starts expanded (default: false). Ignored when `expanded` is passed. */
  defaultExpanded?: boolean;
  /** Controlled open state. Pair with `onExpandedChange`. */
  expanded?: boolean;
  /** Called with the next state when the header is pressed. */
  onExpandedChange?: (expanded: boolean) => void;
  /** Children rendered inside the expandable body. */
  children: ReactNode;
  /** Optional extra actions rendered beside the header button. */
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
  expanded: controlled,
  onExpandedChange,
  children,
  headerRight,
  badgeColor = "purple",
}: CollapsibleSectionProps) {
  const [own, setOwn] = useState(defaultExpanded);
  const expanded = controlled ?? own;
  const toggle = () => {
    const next = !expanded;
    if (controlled === undefined) setOwn(next);
    onExpandedChange?.(next);
  };

  return (
    <div className="rounded-ps-lg border border-ps-edge-hairline bg-ps-surface-panel overflow-hidden">
      {/* Header — always visible */}
      <div className="flex items-center gap-2 pr-5">
        <button
          type="button"
          onClick={toggle}
          className="flex min-w-0 flex-1 items-center justify-between px-5 py-3 text-left hover:bg-ps-surface-raised transition-colors"
          aria-expanded={expanded}
        >
          <div className="flex items-center gap-3">
            <h2 className={sectionHeadingClasses}>
              {title}
            </h2>
            {badge !== undefined && (
              <span
                className={`text-micro font-mono px-1.5 py-0.5 rounded-ps-sm uppercase tracking-widest ${badgeColorMap[badgeColor]}`}
              >
                {badge}
              </span>
            )}
          </div>
          {expanded ? (
            <ChevronUp className="w-4 h-4 shrink-0 text-ps-text-muted" />
          ) : (
            <ChevronDown className="w-4 h-4 shrink-0 text-ps-text-muted" />
          )}
        </button>
        {headerRight && <div className="flex shrink-0 items-center gap-2">{headerRight}</div>}
      </div>

      {/* Body — conditionally rendered */}
      {expanded && (
        <div className="px-5 pb-5 pt-1 border-t border-ps-edge-hairline space-y-4">
          {description && (
            <p className="text-body text-ps-text-muted mt-0.5">{description}</p>
          )}
          {children}
        </div>
      )}
    </div>
  );
}
