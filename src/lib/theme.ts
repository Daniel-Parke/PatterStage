// ═══════════════════════════════════════════════════════════════
// Shared Theme Constants — Single Source of Truth
// ═══════════════════════════════════════════════════════════════

import type { AccentColor } from "@/types/hermes";

/** Aligns main-column top bar with Sidebar brand row (`--ch-shell-header-min-height` in globals.css). */
export const shellHeaderBarClasses =
  "border-b border-white/10 bg-dark-900/50 backdrop-blur-xl min-h-[var(--ch-shell-header-min-height)] flex items-center px-6";

type ColorEntry = string;

const ALL_COLORS: AccentColor[] = ["cyan", "purple", "green", "pink", "orange", "red", "blue", "yellow"];

/**
 * Canonical colour token names — single source of truth.
 * Each colour's Tailwind token suffix (e.g. "neon-cyan" → used in `text-neon-cyan`, `bg-neon-cyan/10`, etc.).
 * Non-neon colours ("red", "blue", "yellow") use their bare Tailwind name.
 */
const COLOR_TOKENS: Record<AccentColor, string> = {
  cyan: "neon-cyan", purple: "neon-purple", green: "neon-green",
  pink: "neon-pink", orange: "neon-orange", red: "red", blue: "blue", yellow: "yellow",
} as const;

/**
 * Text-colour suffix per accent. "red"/"blue"/"yellow" use Tailwind's 400 weight
 * for readability on dark backgrounds; neon colours use their bare name.
 */
const COLOR_TEXT: Record<AccentColor, string> = {
  cyan: "neon-cyan", purple: "neon-purple", green: "neon-green",
  pink: "neon-pink", orange: "neon-orange", red: "red-400", blue: "blue-400", yellow: "yellow-400",
} as const;

/** Whether a colour is one of the three Tailwind base colours (not neon). */
function isBaseColor(c: AccentColor): boolean {
  return c === "red" || c === "blue" || c === "yellow";
}

function makeMap<T>(fn: (c: AccentColor) => T): Record<AccentColor, T> {
  return Object.fromEntries(ALL_COLORS.map((c) => [c, fn(c)])) as Record<AccentColor, T>;
}

// ── Icon Color Map ────────────────────────────────────────────
export const iconColorMap: Record<AccentColor, ColorEntry> = makeMap((c) => `text-${COLOR_TEXT[c]}`);

// ── Border Color Map (for hover effects) — token-aligned ─────
export const colorBorderMap: Record<AccentColor, ColorEntry> = makeMap((c) => {
  const token = COLOR_TOKENS[c];
  const opacity = isBaseColor(c) ? "40" : "30";
  const hoverOpacity = isBaseColor(c) ? "70" : "60";
  const shadowRgb = isBaseColor(c)
    ? ({ red: "239,68,68", blue: "96,165,250", yellow: "250,204,21" } as Record<string, string>)[c]
    : `var(--ch-rgb-${token})`;
  return `border-${token}/${opacity} hover:border-${token}/${hoverOpacity} hover:shadow-[0_0_20px_rgb(${shadowRgb}_/_0.12)]`;
});

// ── Focus Ring Color (for inputs/selects) ─────────────────────
export const focusColorMap: Record<AccentColor, ColorEntry> = makeMap((c) => `focus:border-${COLOR_TOKENS[c]}/50`);

// ── Glow Class Map (legacy box-shadow utilities in globals.css) ─
export const glowClassMap: Record<AccentColor, ColorEntry> = makeMap((c) => {
  if (isBaseColor(c)) return `shadow-${COLOR_TOKENS[c]}-500/20`;
  return `glow-${COLOR_TOKENS[c]}`;
});

/** RGB triplets for `rgb(var(--glow-surface-rgb) / …)` */
const GLOW_RGBS: Record<AccentColor, string> = {
  cyan: "0, 191, 255", purple: "139, 92, 255", green: "163, 255, 18",
  pink: "232, 121, 249", orange: "255, 159, 28", red: "239, 68, 68",
  blue: "96, 165, 250", yellow: "250, 204, 21",
} as const;

export const glowSurfaceRgbMap: Record<AccentColor, ColorEntry> = makeMap((c) => GLOW_RGBS[c]);

// ── Badge Background Color ────────────────────────────────────
export const badgeBgMap: Record<AccentColor, ColorEntry> = makeMap((c) => {
  const suffix = isBaseColor(c) ? `${COLOR_TOKENS[c]}-500` : COLOR_TOKENS[c];
  return `bg-${suffix}/10`;
});

// ── Badge Text Color ──────────────────────────────────────────
export const badgeTextMap: Record<AccentColor, ColorEntry> = makeMap((c) => `text-${COLOR_TEXT[c]}`);

// ── Badge Border Color ────────────────────────────────────────
export const badgeBorderMap: Record<AccentColor, ColorEntry> = makeMap((c) => `border-${COLOR_TOKENS[c]}/20`);

// ── Combined Badge Styles ─────────────────────────────────────
export function badgeClasses(color: AccentColor): string {
  return `${badgeBgMap[color]} ${badgeTextMap[color]} ${badgeBorderMap[color]} border`;
}

// ── Base Input Styles ─────────────────────────────────────────
export const baseInputStyles =
  "w-full bg-dark-900/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none transition-colors font-mono";

/** Canonical text input / select classes with accent focus ring. */
export function inputFieldClasses(accent: AccentColor = "cyan"): string {
  return `${baseInputStyles} ${focusColorMap[accent]}`;
}

// ── Responsive Layout Utilities ────────────────────────────────
// These constants enforce consistent responsive behavior across the app.
// Use them in components to ensure text truncates properly in flex containers.

/**
 * Apply to flex containers that contain text content which may truncate.
 * Required when the container has `flex: 1` or `flex-1` and contains text.
 */
export const RESPONSIVE_MIN_WIDTH_ZERO = "min-w-0";

/**
 * Apply to icons in flex containers to prevent them from being squished.
 * Always add this to icon components when they share space with text.
 */
export const RESPONSIVE_ICON_SHRINK_FALSE = "flex-shrink-0";

/**
 * Apply to the parent grid/container to ensure it doesn't overflow.
 * Use this for grid layouts with potentially long content.
 */
export const RESPONSIVE_GRID_NO_OVERFLOW = "min-w-0";

/**
 * Common responsive grid configurations for consistent use across pages.
 */
export const RESPONSIVE_GRIDS = {
  /** 1 col mobile, 2 col tablet, 4 col desktop - for stats/metrics */
  stats: "grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 min-w-0",
  /** 1 col mobile, 2 col tablet, 3 col desktop - for cards/panels */
  cards: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 min-w-0",
  /** 1 col mobile, 2 col tablet, 4 col desktop - for small cards */
  smallCards: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 min-w-0",
  /** 1 col mobile, 2 col tablet, 3 col desktop - for wide cards */
  wideCards: "grid-cols-1 lg:grid-cols-3 gap-4 min-w-0",
} as const;

/**
 * Card container classes that prevent overflow issues.
 * Use these instead of manually adding overflow handling.
 */
export const RESPONSIVE_CARD_BASE = "rounded-xl border border-white/10 bg-dark-900/50 min-w-0 overflow-hidden";
