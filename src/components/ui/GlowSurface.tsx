"use client";

import type { CSSProperties, ReactNode } from "react";
import type { AccentColor } from "@/types/hermes";
import { glowSurfaceRgbMap } from "@/lib/theme";

export interface GlowSurfaceProps {
  children: ReactNode;
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
  accent,
  intensity = 1,
  animated = false,
  className = "",
  ...rest
}: GlowSurfaceProps & Record<string, unknown>) {
  if (!accent) {
    return <div className={className} {...rest}>{children}</div>;
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
    <div className={glowClasses} style={style} {...rest}>
      {children}
    </div>
  );
}
