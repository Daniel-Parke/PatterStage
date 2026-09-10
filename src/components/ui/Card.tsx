// ═══════════════════════════════════════════════════════════════
// Card Component
// ═══════════════════════════════════════════════════════════════

import { statusToneClasses } from "@/lib/ui/theme";
import type { AccentColor } from "@/types/console";
import GlowSurface from "@/components/ui/GlowSurface";
import type { SurfaceElement } from "@/components/ui/GlowSurface";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  glow?: AccentColor;
  /** Stronger / animated glow (optional). */
  glowIntensity?: number;
  glowAnimated?: boolean;
  hover?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
  /**
   * Which rung the card sits on. `panel` is the default and is what a card
   * on the PAGE is. `raised` is for one nested inside another surface, where
   * the panel rung would be the same fill as its own parent and the card
   * would read as a rule rather than a surface (T-0122).
   */
  variant?: "panel" | "raised";
  /**
   * The element to render. A card is usually a div, but nine of the sites
   * this primitive absorbs are a `<section>`, `<header>` or `<article>`, and
   * rendering those as a div would delete nine landmarks from the
   * accessibility tree. Container elements only: a card is a box, and a
   * `<form>` or a `<button>` needs props this does not carry (T-0122).
   */
  as?: SurfaceElement;
  /**
   * An id and a test id pass through to the element.
   *
   * A primitive that cannot be identified cannot be adopted: the first screen
   * converted onto Card (U9's Automation view) needed to name its rows, and
   * without these the only way to keep a `data-testid` was to keep the div
   * (T-0123).
   */
  id?: string;
  "data-testid"?: string;
}

const paddingMap = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
};

export default function Card({
  children,
  className = "",
  glow,
  glowIntensity = 1,
  glowAnimated = false,
  hover = false,
  padding = "md",
  variant = "panel",
  as,
  id,
  "data-testid": testId,
}: CardProps) {
  const hoverClass = hover
    ? "hover:border-ps-edge-emphasis transition-colors cursor-pointer"
    : "";
  const padClass = paddingMap[padding];

  const fill = variant === "raised" ? "bg-ps-surface-raised" : "bg-ps-surface-panel";
  const innerClasses = `rounded-ps-lg border border-ps-edge-hairline ${fill} min-w-0 ${padClass} ${hoverClass} ${className}`;

  return (
    <GlowSurface
      as={as}
      id={id}
      data-testid={testId}
      accent={glow}
      intensity={glowIntensity}
      animated={glowAnimated}
      className={innerClasses}
      // Bloom tier (WG-WEB-011 C). The card is one of the containers
      // WG-WEB-003 names, so it answers the pointer. The paint rule lives in
      // globals.css and the listener in src/kit/BloomField.tsx; this attribute
      // is the only thing a container needs. Full radius, not "tight": a card
      // is a large surface and the 200px field is sized for one.
      data-bloom=""
    >
      {children}
    </GlowSurface>
  );
}

// ── Status Dot ─────────────────────────────────────────────────
export function StatusDot({
  status,
  pulse = false,
}: {
  status: "online" | "warning" | "error" | "idle";
  pulse?: boolean;
}) {
  // The ladder. `online` is the OK rung rather than a green of its own, and
  // `error` stops being bg-red-500 — a raw ramp step that was one of two reds
  // the product used for the same idea (T-0120).
  const colors = {
    online: statusToneClasses.ok.dot,
    warning: statusToneClasses.warn.dot,
    error: statusToneClasses.fail.dot,
    idle: statusToneClasses.idle.dot,
  };

  return (
    <div
      className={`w-2 h-2 rounded-full ${colors[status]} ${pulse && status === "online" ? "pulse-glow" : ""}`}
    />
  );
}

