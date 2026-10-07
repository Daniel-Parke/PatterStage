// Shared color helpers for the viz primitives. Everything resolves to the neon
// design tokens in globals.css so charts stay on-theme automatically.

import type { NeonColor } from "@/types/console";
export type { NeonColor } from "@/types/console";

/** Solid token color, e.g. var(--color-neon-cyan). */
export const neon = (c: NeonColor): string => `var(--color-neon-${c})`;

/** Token color at an alpha, via color-mix (works for all tokens incl. yellow). */
export const neonAlpha = (c: NeonColor, pct: number): string =>
  `color-mix(in srgb, var(--color-neon-${c}) ${pct}%, transparent)`;

/** A unique-ish DOM id suffix so multiple charts can carry their own <defs>. */
export function gradId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}
