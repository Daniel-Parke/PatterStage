// ═══════════════════════════════════════════════════════════════
// The chrome a button wears, shared by Button and IconButton.
//
// Extracted so the two cannot drift: an icon control that looked like a button
// but hovered differently is how a set of 59 button chromes starts (T-0122).
// Heights live with the components, because a square is not a pill.
// ═══════════════════════════════════════════════════════════════

import type { AccentColor } from "@/types/console";

export type ButtonSize = "sm" | "md" | "lg";
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

/**
 * Three declared heights, not twenty derived ones.
 *
 * 26 / 32 / 40. Padding plus a font size gives you whatever it gives you, and
 * across 25 screens that was twenty distinct heights; a declared height gives
 * you three. The smallest still clears the 24x24 WCAG 2.5.8 asks of a target.
 */
export const buttonHeights: Record<ButtonSize, string> = {
  sm: "h-6.5",
  md: "h-8",
  lg: "h-10",
};

export const buttonPadding: Record<ButtonSize, string> = {
  sm: "px-2.5 text-body gap-1.5",
  md: "px-3.5 text-body gap-2",
  lg: "px-5 text-lead gap-2.5",
};

const colorMap: Record<AccentColor, { bg: string; border: string; text: string; hover: string }> = {
  cyan: {
    bg: "bg-neon-cyan/20",
    border: "border-neon-cyan/30",
    text: "text-neon-cyan",
    hover: "hover:bg-neon-cyan/30",
  },
  purple: {
    bg: "bg-neon-purple/20",
    border: "border-neon-purple/30",
    text: "text-neon-purple",
    hover: "hover:bg-neon-purple/30",
  },
  green: {
    bg: "bg-neon-green/20",
    border: "border-neon-green/30",
    text: "text-neon-green",
    hover: "hover:bg-neon-green/30",
  },
  pink: {
    bg: "bg-neon-pink/20",
    border: "border-neon-pink/30",
    text: "text-neon-pink",
    hover: "hover:bg-neon-pink/30",
  },
  orange: {
    bg: "bg-neon-orange/20",
    border: "border-neon-orange/30",
    text: "text-neon-orange",
    hover: "hover:bg-neon-orange/30",
  },
  red: {
    bg: "bg-red-500/20",
    border: "border-red-500/30",
    text: "text-red-400",
    hover: "hover:bg-red-500/30",
  },
  blue: {
    bg: "bg-blue-500/20",
    border: "border-blue-500/30",
    text: "text-blue-400",
    hover: "hover:bg-blue-500/30",
  },
  yellow: {
    bg: "bg-yellow-500/20",
    border: "border-yellow-500/30",
    text: "text-yellow-400",
    hover: "hover:bg-yellow-500/30",
  },
};

/**
 * Disabled is a COLOUR, not a multiplier.
 *
 * `disabled:opacity-30` multiplies into the text as well as the chrome, so a
 * secondary label (white 70%) lands at an effective 21% alpha and composites
 * to 1.42:1 on the panel rung - the worst contrast measured anywhere in the
 * product, and unreadable rather than merely quiet.
 *
 * `ps-text-faint` is white at 50%, which composites to 4.59:1 on the panel and
 * 3.64:1 on the raised rung. Both clear WCAG 1.4.11's 3:1, and they stay there
 * because a colour cannot compound the way an opacity applied to an
 * already-transparent colour does. The chrome loses its FILL instead of its
 * visibility, which is the honest way to say "not now".
 *
 * The BORDER is deliberately not touched. The first version of this dropped it
 * to the hairline rung, and the live contrast gate caught it on three routes at
 * 1.63:1 - a disabled control is still a control, and quieting its boundary
 * below 3:1 makes it stop reading as one. Each variant therefore keeps its own
 * edge: secondary keeps `ps-edge`, primary keeps its accent, and ghost keeps
 * the transparent one it had rather than growing a box it never has.
 */
const DISABLED =
  "disabled:cursor-not-allowed disabled:bg-transparent disabled:text-ps-text-faint";

export function buttonChrome({
  variant = "secondary",
  color = "cyan",
}: {
  variant?: ButtonVariant;
  color?: AccentColor;
}): string {
  const c = colorMap[color];
  const variantStyles =
    variant === "primary"
      ? `${c.bg} ${c.text} ${c.border} border ${c.hover}`
      : variant === "ghost"
        ? "bg-transparent text-ps-text-secondary border border-transparent hover:bg-ps-surface-raised hover:text-ps-text-primary"
        : variant === "danger"
          ? "bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30"
          : "bg-ps-surface-raised text-ps-text-secondary border border-ps-edge hover:border-ps-edge-emphasis hover:text-ps-text-primary";

  return `inline-flex items-center justify-center rounded-ps-md font-mono transition-colors ${DISABLED} ${variantStyles}`;
}
