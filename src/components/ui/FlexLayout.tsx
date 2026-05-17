// ═══════════════════════════════════════════════════════════════
// FlexItem — Flex container item with built-in overflow prevention
// ═══════════════════════════════════════════════════════════════

import type { ReactNode } from "react";

interface FlexItemProps {
  children: ReactNode;
  className?: string;
  /** Allow item to grow to fill available space (default: true) */
  grow?: boolean;
  /** Allow item to shrink when space is constrained (default: false for icons, true for content) */
  shrink?: boolean;
  /** Make this item a flex container */
  flex?: boolean;
  /** Flex alignment */
  align?: "start" | "center" | "end" | "stretch" | "baseline";
  /** Flex justify */
  justify?: "start" | "center" | "end" | "between" | "around" | "evenly";
  /** Gap between items when flex=true */
  gap?: "xs" | "sm" | "md" | "lg";
}

/**
 * A flex item that prevents overflow issues by default.
 * Critical for flex containers with long text content.
 * 
 * @example
 * // Content that should grow and truncate
 * <FlexItem grow shrink>
 *   <span className="truncate">Long text</span>
 * </FlexItem>
 * 
 * // Icon that should never shrink
 * <FlexItem grow={false} shrink={false}>
 *   <Icon />
 * </FlexItem>
 */
export default function FlexItem({
  children,
  className = "",
  grow = true,
  shrink = true,
  flex = false,
  align,
  justify,
  gap,
}: FlexItemProps) {
  const growClass = grow ? "flex-1" : "";
  const shrinkClass = shrink ? "" : "flex-shrink-0";

  // Flex alignment
  const alignClass = align
    ? ({
        start: "items-start",
        center: "items-center",
        end: "items-end",
        stretch: "items-stretch",
        baseline: "items-baseline",
      }[align])
    : "";

  // Flex justify
  const justifyClass = justify
    ? ({
        start: "justify-start",
        center: "justify-center",
        end: "justify-end",
        between: "justify-between",
        around: "justify-around",
        evenly: "justify-evenly",
      }[justify])
    : "";

  // Gap sizes
  const gapClass = gap
    ? ({
        xs: "gap-1",
        sm: "gap-2",
        md: "gap-3",
        lg: "gap-4",
      }[gap])
    : "";

  const flexClass = flex ? `flex ${gapClass}` : "";

  return (
    <div
      className={`min-w-0 ${growClass} ${shrinkClass} ${alignClass} ${justifyClass} ${flexClass} ${className}`}
    >
      {children}
    </div>
  );
}

// ── Specialized variants ─────────────────────────────────────────

/**
 * A flex container wrapper (the parent flex container)
 */
export function FlexContainer({
  children,
  className = "",
  direction = "row",
  align = "center",
  justify = "start",
  gap = "sm",
  wrap = false,
}: {
  children: ReactNode;
  className?: string;
  direction?: "row" | "col" | "row-reverse" | "col-reverse";
  align?: "start" | "center" | "end" | "stretch" | "baseline";
  justify?: "start" | "center" | "end" | "between" | "around" | "evenly";
  gap?: "xs" | "sm" | "md" | "lg";
  wrap?: boolean;
}) {
  const directionClass = `flex-${direction}`;
  const alignClass = {
    start: "items-start",
    center: "items-center",
    end: "items-end",
    stretch: "items-stretch",
    baseline: "items-baseline",
  }[align];
  const justifyClass = {
    start: "justify-start",
    center: "justify-center",
    end: "justify-end",
    between: "justify-between",
    around: "justify-around",
    evenly: "justify-evenly",
  }[justify];
  const gapClass = {
    xs: "gap-1",
    sm: "gap-2",
    md: "gap-3",
    lg: "gap-4",
  }[gap];
  const wrapClass = wrap ? "flex-wrap" : "";

  return (
    <div
      className={`flex ${directionClass} ${alignClass} ${justifyClass} ${gapClass} ${wrapClass} ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * An icon slot that never shrinks
 */
export function IconSlot({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex-shrink-0 ${className}`}>
      {children}
    </div>
  );
}
