// ═══════════════════════════════════════════════════════════════
// ResponsiveText — Text component with automatic truncation and overflow prevention
// ═══════════════════════════════════════════════════════════════

import type { ReactNode, ElementType } from "react";

interface ResponsiveTextProps {
  children: ReactNode;
  className?: string;
  as?: ElementType;
  /** Truncate text with ellipsis when it overflows */
  truncate?: boolean;
  /** Allow text to wrap (default: true, truncate=false only) */
  wrap?: boolean;
}

/**
 * A text component that prevents overflow issues by default.
 * Use `truncate` for single-line truncation, omit for normal wrapping.
 * 
 * @example
 * // Auto-prevents overflow
 * <ResponsiveText>Long text that might overflow</ResponsiveText>
 * 
 * // Single line with truncation
 * <ResponsiveText truncate>Long text that will be truncated</ResponsiveText>
 * 
 * // As a heading
 * <ResponsiveText as="h2" truncate>Article Title</ResponsiveText>
 */
export default function ResponsiveText({
  children,
  className = "",
  as: Component = "span",
  truncate = false,
  wrap = true,
}: ResponsiveTextProps) {
  const baseClasses = "min-w-0";

  const wrapClasses = truncate
    ? "overflow-hidden whitespace-nowrap text-overflow-ellipsis"
    : wrap
    ? "whitespace-normal"
    : "whitespace-nowrap overflow-hidden text-overflow-ellipsis";

  return (
    <Component className={`${baseClasses} ${wrapClasses} ${className}`}>
      {children}
    </Component>
  );
}

// ── Specialized text variants ──────────────────────────────────

/**
 * Heading variant with built-in truncation support
 */
export function ResponsiveHeading({
  children,
  className = "",
  as: Component = "h2",
  truncate = false,
}: Omit<ResponsiveTextProps, "wrap" | "as"> & { as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6" }) {
  return (
    <ResponsiveText
      as={Component}
      truncate={truncate}
      className={`font-semibold text-white ${className}`}
    >
      {children}
    </ResponsiveText>
  );
}

/**
 * Label variant for form labels and captions
 */
export function ResponsiveLabel({
  children,
  className = "",
  truncate = false,
}: Omit<ResponsiveTextProps, "as" | "wrap">) {
  return (
    <ResponsiveText
      as="label"
      truncate={truncate}
      className={`text-sm font-medium text-white/70 ${className}`}
    >
      {children}
    </ResponsiveText>
  );
}
