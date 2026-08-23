// ═══════════════════════════════════════════════════════════════
// Shared Theme Constants — Single Source of Truth
// ═══════════════════════════════════════════════════════════════

import type { AccentColor } from "@/types/console";

/** Aligns main-column top bar with Sidebar brand row (`--ps-shell-header-min-height` in globals.css). */
export const shellHeaderBarClasses =
  "border-b border-white/10 bg-dark-900/50 backdrop-blur-xl min-h-[var(--ps-shell-header-min-height)] flex items-center px-6";

type ColorEntry = string;

const ALL_COLORS: AccentColor[] = ["cyan", "purple", "green", "pink", "orange", "red", "blue", "yellow"];

function makeMap<T>(fn: (c: AccentColor) => T): Record<AccentColor, T> {
  return Object.fromEntries(ALL_COLORS.map((c) => [c, fn(c)])) as Record<AccentColor, T>;
}

// ═══════════════════════════════════════════════════════════════
// The accent maps below are written out LITERALLY, one class per entry.
//
// They used to be generated with template literals (`text-${COLOR_TEXT[c]}`).
// Tailwind scans source statically and cannot evaluate an expression, so a
// generated class only reached the stylesheet when some unrelated file happened
// to spell out the same literal. Two measured consequences on this tree:
//
//  • `hover:border-neon-cyan/60` and `focus:border-neon-*/50` produced ZERO CSS
//    rules. The border and focus-ring variants simply did not exist. A missing
//    focus ring is an accessibility defect (WCAG 2.4.7), not a cosmetic one.
//  • `border-red/40` was never a valid class at all: the token map gave bare
//    "red", and Tailwind has red-400/red-500, not `red`.
//
// The base/hover classes are also split into separate maps rather than one long
// string. The combined string previously ended in
// `hover:shadow-[0_0_20px_rgb(var(--ps-rgb-neon-cyan)_/_0.12)]`, and that
// malformed candidate took its well-formed neighbours down with it — splitting
// them is what actually made the hover and focus classes appear. The dead
// shadow is dropped rather than resurrected; it never rendered.
//
// `scripts/tooling/design-lint.mjs` (rule `no-template-literal-tailwind`) fails
// the build if the pattern returns. Keep these literal.
// ═══════════════════════════════════════════════════════════════

// ── Icon Color Map ────────────────────────────────────────────
export const iconColorMap: Record<AccentColor, ColorEntry> = {
  cyan: "text-neon-cyan",
  purple: "text-neon-purple",
  green: "text-neon-green",
  pink: "text-neon-pink",
  orange: "text-neon-orange",
  red: "text-red-400",
  blue: "text-blue-400",
  yellow: "text-yellow-400",
};

// ── Border Color Map (for hover effects) — token-aligned ─────
const BORDER_BASE: Record<AccentColor, ColorEntry> = {
  cyan: "border-neon-cyan/30",
  purple: "border-neon-purple/30",
  green: "border-neon-green/30",
  pink: "border-neon-pink/30",
  orange: "border-neon-orange/30",
  red: "border-red-400/40",
  blue: "border-blue-400/40",
  yellow: "border-yellow-400/40",
};

const BORDER_HOVER: Record<AccentColor, ColorEntry> = {
  cyan: "hover:border-neon-cyan/60",
  purple: "hover:border-neon-purple/60",
  green: "hover:border-neon-green/60",
  pink: "hover:border-neon-pink/60",
  orange: "hover:border-neon-orange/60",
  red: "hover:border-red-400/70",
  blue: "hover:border-blue-400/70",
  yellow: "hover:border-yellow-400/70",
};

export const colorBorderMap: Record<AccentColor, ColorEntry> = makeMap(
  (c) => `${BORDER_BASE[c]} ${BORDER_HOVER[c]}`,
);

// ── Focus Ring Color (for inputs/selects) ─────────────────────
export const focusColorMap: Record<AccentColor, ColorEntry> = {
  cyan: "focus:border-neon-cyan/50",
  purple: "focus:border-neon-purple/50",
  green: "focus:border-neon-green/50",
  pink: "focus:border-neon-pink/50",
  orange: "focus:border-neon-orange/50",
  red: "focus:border-red-400/50",
  blue: "focus:border-blue-400/50",
  yellow: "focus:border-yellow-400/50",
};

/** RGB triplets for `rgb(var(--glow-surface-rgb) / …)` */
const GLOW_RGBS: Record<AccentColor, string> = {
  cyan: "0, 191, 255", purple: "164, 128, 255", green: "163, 255, 18",
  pink: "232, 121, 249", orange: "255, 102, 34", red: "239, 68, 68",
  blue: "96, 165, 250", yellow: "250, 204, 21",
} as const;

export const glowSurfaceRgbMap: Record<AccentColor, ColorEntry> = makeMap((c) => GLOW_RGBS[c]);

// ── Badge Background Color ────────────────────────────────────
export const badgeBgMap: Record<AccentColor, ColorEntry> = {
  cyan: "bg-neon-cyan/10",
  purple: "bg-neon-purple/10",
  green: "bg-neon-green/10",
  pink: "bg-neon-pink/10",
  orange: "bg-neon-orange/10",
  red: "bg-red-500/10",
  blue: "bg-blue-500/10",
  yellow: "bg-yellow-500/10",
};

// ── Base Input Styles ─────────────────────────────────────────
export const baseInputStyles =
  "w-full bg-dark-900/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none transition-colors font-mono";

/** Canonical text input / select classes with accent focus ring. */
export function inputFieldClasses(accent: AccentColor = "cyan"): string {
  return `${baseInputStyles} ${focusColorMap[accent]}`;
}
