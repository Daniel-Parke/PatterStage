"use client";

import type { CSSProperties, ReactNode } from "react";
import type { AccentColor } from "@/types/console";
import { glowSurfaceRgbMap } from "@/lib/ui/theme";

/**
 * The elements a surface may be. Containers only, and closed on purpose: an
 * open `ElementType` would let a caller render a `<form>` or a `<button>`
 * here, and this component forwards no props those need (T-0122).
 */
export type SurfaceElement = "div" | "section" | "header" | "article" | "aside";

export interface GlowSurfaceProps {
  children: ReactNode;
  /** The element to render. Defaults to a div. */
  as?: SurfaceElement;
  /** When omitted, renders a plain wrapper (no glow). */
  accent?: AccentColor;
  /** Multiplier for shadow strength (1 = default). */
  intensity?: number;
  /** Subtle breathing animation on the glow. */
  animated?: boolean;
  className?: string;
}

/**
 * Optional neon glow around a surface via CSS variables (`--glow-surface-rgb`, alphas).
 */
export default function GlowSurface({
  children,
  as: Tag = "div",
  accent,
  intensity = 1,
  animated = false,
  className = "",
  ...rest
}: GlowSurfaceProps & Record<string, unknown>) {
  if (!accent) {
    return <Tag className={className} {...rest}>{children}</Tag>;
  }

  const rgb = glowSurfaceRgbMap[accent];
  const alpha = 0.15 * intensity;
  const alphaOuter = 0.05 * intensity;

  const style = {
    "--glow-surface-rgb": rgb,
    "--glow-surface-alpha": String(alpha),
    "--glow-surface-alpha-outer": String(alphaOuter),
  } as CSSProperties;

  const glowClasses = [
    "glow-surface",
    animated ? "glow-surface--pulse" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Tag className={glowClasses} style={style} {...rest}>
      {children}
    </Tag>
  );
}
